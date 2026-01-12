#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import postgres from "postgres";
import { z } from "zod";

// Environment configuration
const DATABASE_URL = process.env.DATABASE_URL;
const ALLOW_WRITE_OPS =
  process.env.DANGEROUSLY_ALLOW_WRITE_OPS === "true" ||
  process.env.DANGEROUSLY_ALLOW_WRITE_OPS === "1";

if (!DATABASE_URL) {
  console.error("Error: DATABASE_URL environment variable is required");
  process.exit(1);
}

// Create postgres connection
const sql = postgres(DATABASE_URL);

// Zod schemas
const QueryToolInputSchema = z.object({
  query: z.string().describe("SQL query to execute"),
});

// Helper function to check if query is a write operation
function isWriteOperation(query: string): boolean {
  const writeKeywords = /^\s*(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE|REPLACE)\s/i;
  return writeKeywords.test(query.trim());
}

// Helper function to get all tables in the database
async function getTables(): Promise<string[]> {
  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;
  return tables.map((row: any) => row.table_name);
}

// Create MCP server
const server = new Server(
  {
    name: "postgres-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "query",
        description: ALLOW_WRITE_OPS
          ? "Execute a SQL query (read or write operations allowed)"
          : "Execute a read-only SQL query (SELECT statements only)",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "SQL query to execute",
            },
          },
          required: ["query"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "query") {
    const input = QueryToolInputSchema.parse(request.params.arguments);
    const query = input.query;

    // Check if write operation is allowed
    if (isWriteOperation(query) && !ALLOW_WRITE_OPS) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Write operations are not allowed. Set DANGEROUSLY_ALLOW_WRITE_OPS=true to enable write operations.",
          },
        ],
      };
    }

    try {
      const result = await sql.unsafe(query);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error executing query: ${error.message}`,
          },
        ],
      };
    }
  }

  throw new Error(`Unknown tool: ${request.params.name}`);
});

// List available resources (tables)
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  try {
    const tables = await getTables();
    return {
      resources: tables.map((table) => ({
        uri: `table:///${table}`,
        name: table,
        description: `PostgreSQL table: ${table}`,
        mimeType: "application/json",
      })),
    };
  } catch (error: any) {
    console.error("Error listing tables:", error);
    return { resources: [] };
  }
});

// Read resource (table data)
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  const match = uri.match(/^table:\/\/\/(.+)$/);

  if (!match) {
    throw new Error(`Invalid resource URI: ${uri}`);
  }

  const tableName = match[1];

  try {
    // Validate table exists
    const tables = await getTables();
    if (!tables.includes(tableName)) {
      throw new Error(`Table not found: ${tableName}`);
    }

    // Get table data (limit to 100 rows for safety)
    const rows = await sql`SELECT * FROM ${sql(tableName)} LIMIT 100`;

    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(rows, null, 2),
        },
      ],
    };
  } catch (error: any) {
    throw new Error(`Error reading table ${tableName}: ${error.message}`);
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`PostgreSQL MCP Server running (Write operations: ${ALLOW_WRITE_OPS ? "ENABLED" : "DISABLED"})`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
