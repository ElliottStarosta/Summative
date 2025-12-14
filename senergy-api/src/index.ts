import 'tsconfig-paths/register'

import { createServer } from './server'

const PORT = parseInt(process.env.PORT || '3001', 10)

const server = createServer()

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
})