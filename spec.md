# Spec

- Allow defining DATABASE_URL through MCP env configuration
- Query postgres data through tool
  - By default, make it readonly
  - Allow write ops by setting ENV `DANGEROUSLY_ALLOW_WRITE_OPS=true|1`
- Access tables as `resources`
- Use Zod for schema definitions
