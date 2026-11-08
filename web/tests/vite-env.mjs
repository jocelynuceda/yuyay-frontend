import { registerHooks } from 'node:module'

registerHooks({
  load(url, context, nextLoad) {
    // Vite resuelve los .svg como URL; en Node basta un texto cualquiera.
    if (new URL(url).pathname.endsWith('.svg')) {
      return { format: 'module', source: `export default ${JSON.stringify(new URL(url).pathname)}`, shortCircuit: true }
    }
    const loaded = nextLoad(url, context)
    if (!new URL(url).pathname.endsWith('/src/services/http.ts')) return loaded
    const source = loaded.source.toString()
    if (!source.includes('import.meta.env.VITE_API_URL')) throw new Error('Expected Vite API URL')
    return { ...loaded, source: source.replace('import.meta.env.VITE_API_URL', '"http://api.test"') }
  },
})
