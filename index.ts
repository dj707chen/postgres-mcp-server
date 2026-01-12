import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListResourceTemplatesRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import postgres from "postgres";
import { z } from "zod";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const DANGEROUSLY_ALLOW_WRITE_OPS = 
  process.env.DANGEROUSLY_ALLOW_WRITE_OPS === "true" || 
  process.env.DANGEROUSLY_ALLOW_WRITE_OPS === "1";

// Initialize postgres client
const sql = postgres(DATABASE_URL);

/**
 * Create an MCP server with capabilities for resources and tools.
 */
const server = new Server(
  {
    name: "postgres-mcp-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

/**
 * List available tables as resources.
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  `;

  return {
    resources: tables.map((table) => ({
      uri: `postgres://table/${table.table_name}`,
      name: `Table: ${table.table_name}`,
      description: `Schema and sample data from the ${table.table_name} table`,
      mimeType: "application/json",
    })),
  };
});

/**
 * Read table schema and sample data.
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const url = new URL(request.params.uri);
  if (url.protocol !== "postgres:") {
    throw new Error(`Unsupported protocol: ${url.protocol}`);
  }

  const tableName = url.pathname.replace(/^\/table\//, "");
  
  // Get columns
  const columns = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = ${tableName} AND table_schema = 'public'
  `;

  // Get sample data (first 10 rows)
  const sampleData = await sql`SELECT * FROM ${sql(tableName)} LIMIT 10`;

  return {
    contents: [
      {
        uri: request.params.uri,
        mimeType: "application/json",
        text: JSON.stringify({
          schema: columns,
          sample: sampleData
        }, null, 2),
      },
    ],
  };
});

/**
 * List available tools.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "query",
        description: "Execute a PostgreSQL query. By default, only SELECT queries are allowed unless write ops are enabled.",
        inputSchema: {
          type: "object",
          properties: {
            sql: {
              type: "string",
              description: "The SQL query to execute",
            },
          },
          required: ["sql"],
        },
      },
    ],
  };
});

/**
 * Handle tool calls.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "query") {
    const { sql: queryText } = z.object({
      sql: z.string()
    }).parse(request.params.arguments);

    // Simple check for write operations if not allowed
    if (!DANGEROUSLY_ALLOW_WRITE_OPS) {
      const isReadonly = queryText.trim().toLowerCase().startsWith("select") || 
                        queryText.trim().toLowerCase().startsWith("with");
      
      if (!isReadonly) {
        return {
          content: [
            {
              type: "text",
              text: "Error: Only SELECT queries are allowed. Set DANGEROUSLY_ALLOW_WRITE_OPS=true to enable write operations.",
            },
          ],
          isError: true,
        };
      }
    }

    try {
      const result = await sql.unsafe(queryText);
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
            text: `Query error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  throw new Error(`Tool not found: ${request.params.name}`);
});

/**
 * Start the server using stdio transport.
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Postgres MCP server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
