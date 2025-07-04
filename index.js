const fs = require("node:fs")
const path = require("node:path")
const os = require("node:os")
const {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require("discord.js")
const { token } = require("./config.json")
const database = require("./database/database")
const { setupPeriodicCleanup } = require("./utils/cleanup")

// Importar o manipulador de interações do painel
const { handlePanelInteraction, MAINTENANCE_MODE } = require("./events/interactionCreate2")

// Configurações do painel
const PAINEL_CHANNEL_ID = "1246908290227507312"

// Cria a instância do cliente
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
  ],
  partials: [Partials.Channel],
})

client.commands = new Collection()

// Sistema de monitoramento avançado
global.botStats = {
  startTime: Date.now(),
  commandsExecuted: 0,
  messagesProcessed: 0,
  errors: [],
  performance: {
    memory: { used: 0, total: 0 },
    cpu: 0,
    uptime: 0,
    ping: 0,
  },
  database: {
    queries: 0,
    errors: 0,
    connections: 0,
  },
}

// Sistema de tickets global
global.ticketSystem = {
  activeTickets: new Map(),
  threadUsers: new Map(),
  database: database,
  stats: {
    totalTickets: 0,
    resolvedTickets: 0,
    averageResponseTime: 0,
  },
}

// Carregar comandos dinamicamente
const commandsPath = path.join(__dirname, "commands")
if (fs.existsSync(commandsPath)) {
  const commandFolders = fs.readdirSync(commandsPath)
  for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder)
    if (fs.statSync(folderPath).isDirectory()) {
      const commandFiles = fs.readdirSync(folderPath).filter((file) => file.endsWith(".js"))
      for (const file of commandFiles) {
        const filePath = path.join(folderPath, file)
        try {
          const command = require(filePath)
          if ("data" in command && "execute" in command) {
            client.commands.set(command.data.name, command)
          } else {
            console.warn(`⚠️ [WARNING] O comando em ${filePath} está sem 'data' ou 'execute'.`)
          }
        } catch (error) {
          console.error(`❌ Erro ao carregar comando ${file}:`, error.message)
        }
      }
    }
  }
}

// Carregar eventos dinamicamente
const eventsPath = path.join(__dirname, "events")
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter((file) => file.endsWith(".js"))
  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file)
    try {
      const event = require(filePath)
      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args))
      } else {
        client.on(event.name, (...args) => event.execute(...args))
      }
    } catch (error) {
      console.error(`❌ Erro ao carregar evento ${file}:`, error.message)
    }
  }
}

// Função para coletar métricas do sistema
function collectSystemMetrics() {
  const memUsage = process.memoryUsage()
  const sysMemory = {
    used: Math.round((memUsage.heapUsed / 1024 / 1024) * 100) / 100,
    total: Math.round((memUsage.heapTotal / 1024 / 1024) * 100) / 100,
  }

  global.botStats.performance = {
    memory: sysMemory,
    cpu: Math.round(process.cpuUsage().user / 1000),
    uptime: Math.floor((Date.now() - global.botStats.startTime) / 1000),
    ping: client.ws ? client.ws.ping : 0,
  }
}

// Função para sincronizar dados do banco
async function syncDatabaseToMemory() {
  try {
    console.log("🔄 Sincronizando dados do sistema...")
    global.ticketSystem.activeTickets.clear()
    global.ticketSystem.threadUsers.clear()

    const activeTicketsQuery = `
      SELECT user_id, thread_id FROM support_tickets 
      WHERE status = 'open'
    `

    const statsQuery = `
      SELECT 
        COUNT(*) as total_tickets,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as resolved_tickets
      FROM support_tickets
    `

    return new Promise((resolve, reject) => {
      database.db.all(activeTicketsQuery, [], (err, rows) => {
        if (err) {
          console.error("❌ Erro ao sincronizar tickets:", err)
          global.botStats.database.errors++
          reject(err)
          return
        }

        rows.forEach((row) => {
          global.ticketSystem.activeTickets.set(row.user_id, row.thread_id)
          global.ticketSystem.threadUsers.set(row.thread_id, row.user_id)
        })

        // Buscar estatísticas
        database.db.get(statsQuery, [], (err, stats) => {
          if (!err && stats) {
            global.ticketSystem.stats.totalTickets = stats.total_tickets || 0
            global.ticketSystem.stats.resolvedTickets = stats.resolved_tickets || 0
          }
        })

        global.botStats.database.queries++
        console.log(`✅ Sistema sincronizado - ${rows.length} tickets ativos`)
        resolve(rows.length)
      })
    })
  } catch (error) {
    console.error("❌ Erro na sincronização:", error)
    global.botStats.errors.push({
      type: "DATABASE_SYNC",
      message: error.message,
      timestamp: new Date(),
    })
    throw error
  }
}

// Função para criar embeds do painel principal (múltiplas embeds)
function createMainPanelEmbeds() {
  collectSystemMetrics()

  const uptime = global.botStats.performance.uptime
  const uptimeFormatted = `${Math.floor(uptime / 86400)}d ${Math.floor((uptime % 86400) / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`

  const healthStatus =
    global.botStats.performance.ping < 100
      ? "🟢 Excelente"
      : global.botStats.performance.ping < 200
        ? "🟡 Bom"
        : "🔴 Ruim"

  const maintenanceMode = MAINTENANCE_MODE()

  // Embed principal - Status do sistema
  const mainEmbed = new EmbedBuilder()
    .setTitle("☁️ iCloud Bot - Painel de Controle Executivo")
    .setDescription(
      `**Sistema de Recrutamento e Gerenciamento**\n\n**Status Operacional:** ${maintenanceMode ? "🔧 Em Manutenção" : "🟢 Online"}\n**Qualidade da Conexão:** ${healthStatus}\n**Tempo de Atividade:** ${uptimeFormatted}`,
    )
    .setColor(maintenanceMode ? "#FF6B6B" : "#4A90E2")
    .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setFooter({
      text: `iCloud Bot v3.0 • Sistema de Recrutamento • ${new Date().toLocaleString("pt-BR")}`,
      iconURL: client.user.displayAvatarURL({ dynamic: true }),
    })
    .setTimestamp()

  // Embed de performance
  const performanceEmbed = new EmbedBuilder()
    .setTitle("📊 Métricas de Performance")
    .addFields(
      {
        name: "🚀 Sistema",
        value: `**CPU:** ${global.botStats.performance.cpu}%\n**RAM:** ${global.botStats.performance.memory.used}MB / ${global.botStats.performance.memory.total}MB\n**Latência:** ${global.botStats.performance.ping}ms`,
        inline: true,
      },
      {
        name: "📈 Atividade",
        value: `**Comandos Executados:** ${global.botStats.commandsExecuted.toLocaleString()}\n**Mensagens Processadas:** ${global.botStats.messagesProcessed.toLocaleString()}\n**Interações/min:** ${Math.floor(global.botStats.commandsExecuted / Math.max(1, uptime / 60))}`,
        inline: true,
      },
      {
        name: "🌐 Conectividade",
        value: `**Servidores:** ${client.guilds.cache.size}\n**Usuários:** ${client.users.cache.size.toLocaleString()}\n**Canais:** ${client.channels.cache.size}`,
        inline: true,
      },
    )
    .setColor("#00D9FF")
    .setFooter({ text: "iCloud Bot • Monitoramento em Tempo Real" })

  // Embed de sistema de recrutamento e tickets
  const systemEmbed = new EmbedBuilder()
    .setTitle("🎯 Sistema de Recrutamento & Suporte")
    .addFields(
      {
        name: "🎫 Central de Tickets",
        value: `**Tickets Ativos:** ${global.ticketSystem.activeTickets.size}\n**Total Processados:** ${global.ticketSystem.stats.totalTickets}\n**Taxa de Resolução:** ${((global.ticketSystem.stats.resolvedTickets / Math.max(1, global.ticketSystem.stats.totalTickets)) * 100).toFixed(1)}%`,
        inline: true,
      },
      {
        name: "💾 Banco de Dados",
        value: `**Queries Executadas:** ${global.botStats.database.queries.toLocaleString()}\n**Conexões Ativas:** ${global.botStats.database.connections}\n**Taxa de Erro:** ${((global.botStats.database.errors / Math.max(1, global.botStats.database.queries)) * 100).toFixed(2)}%`,
        inline: true,
      },
      {
        name: "⚠️ Monitoramento",
        value: `**Erros Registrados:** ${global.botStats.errors.length}\n**Status do Sistema:** ${global.botStats.errors.length > 10 ? "🔴 Atenção" : "🟢 Estável"}\n**Última Verificação:** ${new Date().toLocaleTimeString("pt-BR")}`,
        inline: true,
      },
    )
    .setColor("#FFD700")
    .setFooter({ text: "iCloud Bot • Sistema de Recrutamento e Suporte" })

  return [mainEmbed, performanceEmbed, systemEmbed]
}

// Função para criar botões do painel principal
function createMainPanelButtons() {
  const maintenanceMode = MAINTENANCE_MODE()

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("panel_refresh").setLabel("🔄 Atualizar Painel").setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("panel_maintenance")
      .setLabel(maintenanceMode ? "✅ Sair da Manutenção" : "🔧 Modo Manutenção")
      .setStyle(maintenanceMode ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("panel_logs").setLabel("📋 Visualizar Logs").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("panel_database").setLabel("💾 Info do Banco").setStyle(ButtonStyle.Secondary),
  )

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("panel_tickets").setLabel("🎫 Central de Tickets").setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("panel_commands")
      .setLabel("⚡ Sistema de Comandos")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("panel_restart").setLabel("🔄 Reiniciar Sistema").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("panel_shutdown").setLabel("🛑 Desligar Bot").setStyle(ButtonStyle.Danger),
  )

  const row3 = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("panel_quick_actions")
      .setPlaceholder("🚀 Selecione uma Ação Rápida")
      .addOptions([
        {
          label: "Limpar Cache do Sistema",
          description: "Remove todos os dados em cache para otimização",
          value: "clear_cache",
          emoji: "🧹",
        },
        {
          label: "Sincronizar Comandos",
          description: "Atualiza todos os comandos slash no Discord",
          value: "sync_commands",
          emoji: "⚡",
        },
        {
          label: "Backup do Banco de Dados",
          description: "Cria um backup completo do banco de dados",
          value: "backup_database",
          emoji: "💾",
        },
        {
          label: "Relatório Executivo Completo",
          description: "Gera relatório detalhado de todas as métricas",
          value: "detailed_report",
          emoji: "📊",
        },
        {
          label: "Estatísticas de Recrutamento",
          description: "Visualiza dados do sistema de recrutamento",
          value: "recruitment_stats",
          emoji: "🎯",
        },
      ]),
  )

  return [row1, row2, row3]
}

// Event listener para interações
client.on("interactionCreate", async (interaction) => {
  // Função auxiliar para responder interações de forma segura
  async function safeReply(interaction, content) {
    try {
      if (interaction.replied || interaction.deferred) {
        return await interaction.followUp(content)
      } else {
        return await interaction.reply(content)
      }
    } catch (error) {
      console.error("❌ Erro ao responder interação:", error.message)
      return null
    }
  }

  // ===== COMANDOS SLASH =====
  if (interaction.isChatInputCommand()) {
    global.botStats.commandsExecuted++
    const command = client.commands.get(interaction.commandName)

    if (!command) {
      console.error(`Comando ${interaction.commandName} não encontrado.`)
      return
    }

    try {
      await command.execute(interaction)
    } catch (error) {
      console.error("Erro ao executar comando:", error)
      global.botStats.errors.push({
        type: "COMMAND_ERROR",
        message: error.message,
        timestamp: new Date(),
      })

      const errorContent = {
        content: "Houve um erro ao executar este comando!",
        ephemeral: true,
      }

      await safeReply(interaction, errorContent)
    }
    return
  }

  // ===== BOTÕES E SELECT MENUS =====
  if (interaction.isButton() || interaction.isStringSelectMenu()) {
    // Verificar se a interação ainda é válida (não expirou)
    const interactionAge = Date.now() - interaction.createdTimestamp
    if (interactionAge > 2500) {
      console.warn(`⚠️ Interação expirada (${interactionAge}ms): ${interaction.customId}`)
      return
    }

    // Lista de customIds do painel de controle
    const panelCustomIds = [
      "panel_refresh",
      "panel_maintenance",
      "panel_logs",
      "panel_database",
      "panel_tickets",
      "panel_commands",
      "panel_restart",
      "panel_shutdown",
      "panel_quick_actions",
      "confirm_restart",
      "cancel_restart",
      "confirm_shutdown",
      "cancel_shutdown",
    ]

    // Se for interação do painel de controle
    if (
      panelCustomIds.includes(interaction.customId) ||
      (interaction.isStringSelectMenu() && interaction.customId === "panel_quick_actions")
    ) {
      await handlePanelInteraction(
        interaction,
        client,
        database,
        syncDatabaseToMemory,
        createMainPanelEmbeds,
        createMainPanelButtons,
      )
      return
    }

    // Para todas as outras interações (convites, suporte, etc.)
    // Deixar o events/interactionCreate.js processar
    return
  }
})

// Evento quando o bot está pronto
client.once("ready", async () => {
  console.log(`✅ iCloud Bot conectado como ${client.user.tag}`)
  console.log(`🔗 Conectado a ${client.guilds.cache.size} servidor(es)`)

  try {
    await syncDatabaseToMemory()
    console.log("🎧 Sistema de recrutamento e suporte inicializado com sucesso")
  } catch (error) {
    console.error("❌ Erro ao inicializar sistema:", error)
  }

  // Configurar sistema de limpeza automática
  setupPeriodicCleanup(client)

  // Enviar painel de controle
  const painelChannel = client.channels.cache.get(PAINEL_CHANNEL_ID)
  if (painelChannel?.isTextBased()) {
    const embeds = createMainPanelEmbeds()
    const components = createMainPanelButtons()
    await painelChannel.send({
      content: "# ☁️ iCloud Bot - Painel de Controle Executivo\n*Sistema de Recrutamento e Gerenciamento Avançado*",
      embeds,
      components,
    })
  }

  // Atualizar métricas a cada 30 segundos
  setInterval(() => {
    collectSystemMetrics()
  }, 30000)

  // ✅ INICIAR API APÓS O BOT ESTAR PRONTO E AGUARDAR UM POUCO
  setTimeout(() => {
    try {
      console.log("🌐 Iniciando API de documentação...")
      const apiServer = require("./api")(client)
      if (apiServer) {
        console.log("✅ API de documentação iniciada com sucesso!")
      } else {
        console.error("❌ Falha ao iniciar API de documentação")
      }
    } catch (error) {
      console.error("❌ Erro ao iniciar API:", error)
    }
  }, 3000) // Aguardar 3 segundos após o bot estar pronto
})

// Monitoramento de mensagens
client.on("messageCreate", () => {
  global.botStats.messagesProcessed++
})

// Tratamento de erros
client.on("error", (error) => {
  console.error("Erro do cliente:", error)
  global.botStats.errors.push({
    type: "CLIENT_ERROR",
    message: error.message,
    timestamp: new Date(),
  })
})

process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error)
  global.botStats.errors.push({
    type: "UNHANDLED_REJECTION",
    message: error.message,
    timestamp: new Date(),
  })
})

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("🔄 Encerrando iCloud Bot...")
  database.close()
  client.destroy()
  process.exit(0)
})

// Login do bot
client.login(token)
