# 

Based on https://cursor.com/docs/cookbook/building-mcp-server#how-to-build-the-mcp-server

```shell
cd ~/AI/cursor
gh repo clone dj707chen/postgres-mcp-server
cd postgres-mcp-server
Bun init

# add 3 dependencies:
bun add postgres @modelcontextprotocol/sdk zod

cat > spec.md <<'END'
# Spec

- Allow defining DATABASE_URL through MCP env configuration
- Query postgres data through tool
  - By default, make it readonly
  - Allow write ops by setting ENV `DANGEROUSLY_ALLOW_WRITE_OPS=true|1`
- Access tables as `resources`
- Use Zod for schema definitions
END

# Initial prompt
cat > initialPrompt.txt <<'END'
Read the following and follow @spec.md to understand what we want. All necessary dependencies are installed
- @https://raw.githubusercontent.com/modelcontextprotocol/typescript-sdk/refs/heads/main/README.md
- @https://raw.githubusercontent.com/porsager/postgres/refs/heads/master/README.md
END

```

