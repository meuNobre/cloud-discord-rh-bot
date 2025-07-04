const express = require("express")
const cors = require("cors")

module.exports = (client) => {
  // Verificar se o client está disponível
  if (!client) {
    console.error("❌ Client não fornecido para a API")
    return null
  }

  const app = express()
  const port = 3001

  // Middleware básico
  app.use(
    cors({
      origin: "*",
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  )

  app.use(express.json({ limit: "10mb" }))

  // Middleware de log para debug
  app.use((req, res, next) => {
    console.log(`📡 ${req.method} ${req.path} - ${new Date().toISOString()}`)
    next()
  })

  // Endpoint principal - Status completo
  app.get("/status", (req, res) => {
    try {
      console.log("📊 Requisição recebida em /status")

      // Verificar se o client está pronto
      const isOnline = client && client.isReady && client.isReady()

      // Obter comandos de forma segura
      let commands = []
      if (client && client.commands) {
        try {
          if (client.commands instanceof Map) {
            commands = Array.from(client.commands.values()).map((cmd) => ({
              name: cmd.data?.name || cmd.name || "Comando",
              description: cmd.data?.description || cmd.description || "Sem descrição",
              category: cmd.category || "Geral",
            }))
          } else if (Array.isArray(client.commands)) {
            commands = client.commands.map((cmd) => ({
              name: cmd.data?.name || cmd.name || "Comando",
              description: cmd.data?.description || cmd.description || "Sem descrição",
              category: cmd.category || "Geral",
            }))
          }
        } catch (cmdError) {
          console.warn("⚠️ Erro ao processar comandos:", cmdError.message)
          commands = []
        }
      }

      // Calcular usuários e guilds de forma segura
      let totalUsers = 0
      let totalGuilds = 0

      if (client && client.guilds && client.guilds.cache) {
        try {
          totalGuilds = client.guilds.cache.size
          totalUsers = client.guilds.cache.reduce((acc, guild) => {
            return acc + (guild.memberCount || 0)
          }, 0)
        } catch (guildError) {
          console.warn("⚠️ Erro ao calcular guilds/users:", guildError.message)
        }
      }

      // Obter informações do bot incluindo avatar
      let botInfo = {
        id: null,
        username: null,
        avatar: null,
        tag: null,
      }

      if (client && client.user) {
        try {
          botInfo = {
            id: client.user.id,
            username: client.user.username,
            avatar: client.user.displayAvatarURL ? client.user.displayAvatarURL({ size: 256, format: "png" }) : null,
            tag: client.user.tag,
          }
        } catch (botError) {
          console.warn("⚠️ Erro ao obter informações do bot:", botError.message)
        }
      }

      // Usar as estatísticas globais se disponíveis
      const stats = global.botStats || {}
      const ticketStats = global.ticketSystem?.stats || {}

      const response = {
        online: isOnline,
        guilds: totalGuilds,
        users: totalUsers,
        commands: commands,

        // Informações do bot
        bot: botInfo,

        // Estatísticas do sistema (se disponíveis)
        stats: {
          uptime: stats.performance?.uptime || process.uptime(),
          ping: client && client.ws ? client.ws.ping : 0,
          memory: stats.performance?.memory || {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          },
          commandsExecuted: stats.commandsExecuted || 0,
          messagesProcessed: stats.messagesProcessed || 0,
          errors: stats.errors?.length || 0,
        },

        // Sistema de tickets (se disponível)
        tickets: {
          active: global.ticketSystem?.activeTickets?.size || 0,
          total: ticketStats.totalTickets || 0,
          resolved: ticketStats.resolvedTickets || 0,
        },

        lastUpdate: new Date().toISOString(),
      }

      console.log("✅ Resposta enviada:", {
        online: response.online,
        guilds: response.guilds,
        users: response.users,
        commandsCount: response.commands.length,
        botAvatar: response.bot.avatar ? "✅ Avatar disponível" : "❌ Avatar não disponível",
        botUsername: response.bot.username || "Não disponível",
      })

      res.json(response)
    } catch (error) {
      console.error("❌ Erro na API /status:", error)

      // Resposta de fallback em caso de erro
      res.status(500).json({
        online: false,
        guilds: 0,
        users: 0,
        commands: [],
        bot: {
          id: null,
          username: null,
          avatar: null,
          tag: null,
        },
        stats: {
          uptime: 0,
          ping: 0,
          memory: { used: 0, total: 0 },
          commandsExecuted: 0,
          messagesProcessed: 0,
          errors: 0,
        },
        tickets: {
          active: 0,
          total: 0,
          resolved: 0,
        },
        error: "Erro interno do servidor",
        message: error.message,
      })
    }
  })

  // Endpoint específico para informações do bot
  app.get("/bot", (req, res) => {
    try {
      console.log("🤖 Requisição recebida em /bot")

      let botInfo = {
        id: null,
        username: null,
        discriminator: null,
        tag: null,
        avatar: null,
        createdAt: null,
        ready: false,
      }

      if (client && client.user) {
        try {
          botInfo = {
            id: client.user.id,
            username: client.user.username,
            discriminator: client.user.discriminator,
            tag: client.user.tag,
            avatar: client.user.displayAvatarURL ? client.user.displayAvatarURL({ size: 512, format: "png" }) : null,
            createdAt: client.user.createdAt,
            ready: client.isReady ? client.isReady() : false,
          }
        } catch (botError) {
          console.warn("⚠️ Erro ao obter informações detalhadas do bot:", botError.message)
        }
      }

      console.log("✅ Informações do bot enviadas:", {
        username: botInfo.username || "Não disponível",
        avatar: botInfo.avatar ? "✅ Avatar disponível" : "❌ Avatar não disponível",
        ready: botInfo.ready,
      })

      res.json(botInfo)
    } catch (error) {
      console.error("❌ Erro na API /bot:", error)
      res.status(500).json({
        error: "Erro ao buscar informações do bot",
        id: null,
        username: null,
        avatar: null,
      })
    }
  })

  // Health check simples
  app.get("/health", (req, res) => {
    try {
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        bot: {
          ready: client && client.isReady ? client.isReady() : false,
          ping: client && client.ws ? client.ws.ping : 0,
        },
      })
    } catch (error) {
      console.error("❌ Erro no health check:", error)
      res.status(500).json({
        status: "error",
        message: error.message,
      })
    }
  })

  // Middleware para rotas não encontradas
  app.use("*", (req, res) => {
    res.status(404).json({
      error: "Endpoint não encontrado",
      availableEndpoints: [
        "GET /status - Status completo do bot",
        "GET /bot - Informações do bot",
        "GET /health - Health check",
      ],
    })
  })

  // Tratamento de erros global
  app.use((error, req, res, next) => {
    console.error("❌ Erro na API:", error)
    res.status(500).json({
      error: "Erro interno do servidor",
      message: error.message,
    })
  })

  // Iniciar servidor com tratamento de erro
  let server = null

  try {
    server = app.listen(port, () => {
      console.log(`🚀 API de status do bot rodando em http://localhost:${port}`)
      console.log(`📊 Endpoints disponíveis:`)
      console.log(`   GET /status - Status completo do bot`)
      console.log(`   GET /bot - Informações do bot`)
      console.log(`   GET /health - Health check`)
    })

    // Tratamento de erros do servidor
    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        console.error(`❌ Porta ${port} já está em uso!`)
        console.log("💡 Tente fechar outros processos ou usar outra porta")
      } else {
        console.error("❌ Erro no servidor:", error)
      }
    })

    // Graceful shutdown
    process.on("SIGTERM", () => {
      if (server) {
        console.log("🛑 Fechando servidor da API...")
        server.close(() => {
          console.log("✅ Servidor da API fechado")
        })
      }
    })
  } catch (error) {
    console.error("❌ Erro ao iniciar servidor da API:", error)
    return null
  }

  return server
}
