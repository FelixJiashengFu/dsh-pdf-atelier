# Lifecycles first

A plugin system is mostly a lifecycle system. Everything a plugin registers must be released when it unloads, or reloads slowly poison the process.

```ts
export function apply(ctx: Context) {
  const dispose = ctx.tools.register(myTool)
  // Owned by the context: unloading the row calls this.
  ctx.effect(() => dispose)
}
```

:::note
Treat registration as acquiring a resource. If there is no matching release, it is a leak.
:::

## Isolation boundaries

:::columns
##### In process

Fast and simple, but a crash takes the host with it.

---

##### Out of process

Safe and slower. Each call crosses a pipe, and `stdout` becomes a protocol you must guard.
:::

Table: Cost of a single tool call by isolation model (illustrative).

| Model | Latency | Crash impact | Reload |
|---|---|---|---|
| In process | 0.2 ms | Host | Instant |
| Worker thread | 1.5 ms | Worker | Fast |
| Subprocess | 12 ms | Plugin only | Slow |

# Failing well

A plugin error must never read as a host error. Wrap each call, attach the plugin's name, and keep the session alive.

```python
def call_tool(plugin, name, args):
    try:
        return plugin.tools[name](**args)
    except Exception as exc:
        raise PluginError(plugin.id, name) from exc
```

:::warn
Never retry a tool call that may have had side effects unless the tool declares itself idempotent.
:::

# Checklist

- Every registration has a disposer
- Timeouts are per call, not per session
- Logs carry the plugin id
- A reload test runs in CI
