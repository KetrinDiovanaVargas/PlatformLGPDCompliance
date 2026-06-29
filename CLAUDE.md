# LGPD Compliance Platform

## Token Savings via Headroom

Headroom MCP is available. Use it to compress large content before reasoning, saving context window space.

### When to compress

Use `mcp__headroom__headroom_compress` automatically when:

- **Files > 150 lines** — compress the content after reading, reason over the compressed version
- **Search results > 30 matches** — compress grep/glob output before analyzing
- **Build/test output > 100 lines** — compress before parsing errors
- **Any tool output > 200 lines** — compress before reasoning

### How to use

```
# Compress large content
result = headroom_compress(content: <large_text>)
# Returns: compressed text + hash

# Later, if full details needed
original = headroom_retrieve(hash: <hash_from_compress>)
```

### Never compress
- Short outputs (< 150 lines)
- Error messages you need to read verbatim
- Content you're about to edit directly

### Check savings
Run `headroom_stats` at any time to see tokens saved this session.
