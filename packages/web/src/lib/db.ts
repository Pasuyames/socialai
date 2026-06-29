import { PrismaClient } from '@prisma/client'
import { deriveAgentLogStatus } from './agentLogStatus'

const prismaClientSingleton = () => {
  const base = new PrismaClient()
  // Edge Runtime (NextAuth middleware) $extends'i desteklemez → orada düz client dön.
  if (process.env.NEXT_RUNTIME === 'edge') return base
  // Node tarafında: agentLog.create'de status vermezse action'dan otomatik türet.
  return base.$extends({
    query: {
      agentLog: {
        create({ args, query }) {
          const data: any = args.data
          if (data && (data.status === undefined || data.status === null)) {
            data.status = deriveAgentLogStatus(data.action ?? '')
          }
          return query(args)
        },
      },
    },
  }) as unknown as PrismaClient
}

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prisma ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma