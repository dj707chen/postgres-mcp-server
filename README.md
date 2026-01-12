# postgres-mcp-server

A Model Context Protocol (MCP) server for PostgreSQL that provides query execution and table access as resources.

## Features

- **Query Tool**: Execute SQL queries against your PostgreSQL database
  - Read-only by default (SELECT queries only)
  - Optional write operations with `DANGEROUSLY_ALLOW_WRITE_OPS=true`
- **Resources**: Access database tables as MCP resources
  - List all available tables
  - Read table data (limited to 100 rows per table)
- **Environment Configuration**: Configure database connection via `DATABASE_URL`
- **Type Safety**: Uses Zod for input validation

## Installation

```bash
bun install
```

## Configuration

Set the following environment variables:

- `DATABASE_URL` (required): PostgreSQL connection string
  - Example: `postgres://user:password@localhost:5432/dbname`
- `DANGEROUSLY_ALLOW_WRITE_OPS` (optional): Enable write operations
  - Set to `true` or `1` to allow INSERT, UPDATE, DELETE, etc.
  - Default: disabled (read-only mode)

## Usage

### Basic Usage (Read-only)

```bash
export DATABASE_URL=postgres://localhost/mydb
bun run index.ts
```

### With Write Operations Enabled

```bash
export DATABASE_URL=postgres://localhost/mydb
export DANGEROUSLY_ALLOW_WRITE_OPS=true
bun run index.ts
```

### Testing with MCP Inspector

```bash
export DATABASE_URL=postgres://localhost/mydb
npx @modelcontextprotocol/inspector bun run index.ts
```

## MCP Tools

### query

Execute SQL queries against the database.

**Input:**
- `query` (string): SQL query to execute

**Behavior:**
- In read-only mode: Only SELECT queries are allowed
- With write operations enabled: All SQL operations are allowed

## MCP Resources

The server exposes database tables as resources with URIs in the format:

```
table:///<table_name>
```

**Available Operations:**
- List all tables in the database
- Read table data (returns up to 100 rows as JSON)

## Security Notes

- By default, the server operates in read-only mode to prevent accidental data modification
- Write operations must be explicitly enabled with `DANGEROUSLY_ALLOW_WRITE_OPS`
- All queries are executed using the credentials provided in `DATABASE_URL`
- Table access is limited to the `public` schema
