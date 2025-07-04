// Utilitário para debug do sistema de convites

class DebugHelper {
  static logUserInfo(user, context = "") {
    console.log(`🔍 [DEBUG${context ? ` - ${context}` : ""}] Informações do usuário:`)
    console.log(`   👤 Tag: ${user?.tag || "NULL"}`)
    console.log(`   🆔 ID: ${user?.id || "NULL"}`)
    console.log(`   🤖 Bot: ${user?.bot || "NULL"}`)
    console.log(`   📅 Criado: ${user?.createdAt || "NULL"}`)
    console.log(`   🖼️ Avatar: ${user?.avatar || "NULL"}`)
  }

  static logInteractionInfo(interaction, context = "") {
    console.log(`🔍 [DEBUG${context ? ` - ${context}` : ""}] Informações da interação:`)
    console.log(`   👤 Usuário: ${interaction.user?.tag || "NULL"}`)
    console.log(`   🆔 ID: ${interaction.user?.id || "NULL"}`)
    console.log(`   📍 Canal: ${interaction.channel?.id || "NULL"}`)
    console.log(`   🏠 Servidor: ${interaction.guild?.name || "DM"}`)
    console.log(`   ⏰ Timestamp: ${interaction.createdTimestamp}`)
    console.log(`   🕐 Idade: ${Date.now() - interaction.createdTimestamp}ms`)
  }

  static logCommandOptions(interaction) {
    console.log(`🔍 [DEBUG] Opções do comando:`)
    const options = interaction.options.data
    options.forEach((option, index) => {
      console.log(`   ${index + 1}. ${option.name}: ${option.value} (${option.type})`)
      if (option.user) {
        console.log(`      👤 Usuário: ${option.user.tag} (${option.user.id})`)
      }
    })
  }

  static async testDatabaseConnection(database) {
    console.log(`🔍 [DEBUG] Testando conexão com banco de dados...`)

    try {
      // Testar consulta simples
      const result = await database.db.get("SELECT 1 as test")
      console.log(`   ✅ Conexão OK: ${JSON.stringify(result)}`)

      // Testar tabela de convites
      const inviteCount = await new Promise((resolve, reject) => {
        database.db.get("SELECT COUNT(*) as count FROM recruitment_invites", (err, row) => {
          if (err) reject(err)
          else resolve(row.count)
        })
      })
      console.log(`   📊 Total de convites: ${inviteCount}`)

      return true
    } catch (error) {
      console.error(`   ❌ Erro na conexão: ${error.message}`)
      return false
    }
  }

  static logError(error, context = "") {
    console.error(`❌ [ERROR${context ? ` - ${context}` : ""}]:`)
    console.error(`   📝 Mensagem: ${error.message}`)
    console.error(`   📍 Stack: ${error.stack}`)
    console.error(`   🕐 Timestamp: ${new Date().toISOString()}`)
  }

  static async validateUserObject(user, interaction) {
    console.log(`🔍 [DEBUG] Validando objeto do usuário...`)

    if (!user) {
      console.error(`   ❌ Usuário é null/undefined`)

      // Tentar obter informações da opção
      const option = interaction.options.get("candidato")
      console.log(`   🔍 Opção raw:`, option)

      if (option) {
        console.log(`   🔍 Valor da opção: ${option.value}`)
        console.log(`   🔍 Tipo da opção: ${option.type}`)

        // Tentar buscar usuário pelo ID
        try {
          const fetchedUser = await interaction.client.users.fetch(option.value, { force: true })
          console.log(`   ✅ Usuário encontrado via fetch: ${fetchedUser.tag}`)
          return fetchedUser
        } catch (fetchError) {
          console.error(`   ❌ Erro ao buscar usuário: ${fetchError.message}`)
          return null
        }
      }

      return null
    }

    console.log(`   ✅ Usuário válido: ${user.tag}`)
    return user
  }
}

module.exports = DebugHelper
