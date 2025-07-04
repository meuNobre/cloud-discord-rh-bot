// Utilitário para validar e corrigir problemas de interação

class InteractionValidator {
  static isInteractionValid(interaction) {
    const age = Date.now() - interaction.createdTimestamp
    const isValid = age < 2500 && !interaction.replied && !interaction.deferred

    console.log(`🔍 [VALIDATION] Interação válida: ${isValid}`)
    console.log(`   ⏰ Idade: ${age}ms`)
    console.log(`   📝 Respondida: ${interaction.replied}`)
    console.log(`   ⏳ Deferida: ${interaction.deferred}`)

    return isValid
  }

  static async safeReply(interaction, content) {
    try {
      if (interaction.replied) {
        return await interaction.followUp(content)
      } else if (interaction.deferred) {
        return await interaction.editReply(content)
      } else {
        return await interaction.reply(content)
      }
    } catch (error) {
      console.error("❌ Erro ao responder interação:", error.message)
      return null
    }
  }

  static async safeEdit(interaction, content) {
    try {
      if (interaction.replied || interaction.deferred) {
        return await interaction.editReply(content)
      } else {
        return await interaction.reply(content)
      }
    } catch (error) {
      console.error("❌ Erro ao editar interação:", error.message)
      return null
    }
  }

  static getUserFromOptions(interaction, optionName) {
    console.log(`🔍 [USER_FETCH] Tentando obter usuário da opção: ${optionName}`)

    // Método 1: getUser()
    try {
      const user = interaction.options.getUser(optionName)
      if (user) {
        console.log(`✅ [USER_FETCH] Método 1 sucesso: ${user.tag}`)
        return user
      }
    } catch (error) {
      console.log(`❌ [USER_FETCH] Método 1 falhou: ${error.message}`)
    }

    // Método 2: get() + cache
    try {
      const option = interaction.options.get(optionName)
      if (option && option.value) {
        const user = interaction.client.users.cache.get(option.value)
        if (user) {
          console.log(`✅ [USER_FETCH] Método 2 sucesso: ${user.tag}`)
          return user
        }
      }
    } catch (error) {
      console.log(`❌ [USER_FETCH] Método 2 falhou: ${error.message}`)
    }

    console.log(`❌ [USER_FETCH] Todos os métodos falharam`)
    return null
  }

  static async fetchUserFromOptions(interaction, optionName) {
    console.log(`🔍 [USER_FETCH_ASYNC] Tentando buscar usuário: ${optionName}`)

    // Primeiro tentar métodos síncronos
    const user = this.getUserFromOptions(interaction, optionName)
    if (user) return user

    // Método 3: fetch()
    try {
      const option = interaction.options.get(optionName)
      if (option && option.value) {
        const user = await interaction.client.users.fetch(option.value, { force: true })
        if (user) {
          console.log(`✅ [USER_FETCH_ASYNC] Método 3 sucesso: ${user.tag}`)
          return user
        }
      }
    } catch (error) {
      console.log(`❌ [USER_FETCH_ASYNC] Método 3 falhou: ${error.message}`)
    }

    return null
  }

  static logInteractionDetails(interaction) {
    console.log(`🔍 [INTERACTION_DETAILS]`)
    console.log(`   👤 Usuário: ${interaction.user.tag} (${interaction.user.id})`)
    console.log(`   📍 Canal: ${interaction.channelId}`)
    console.log(`   🏠 Servidor: ${interaction.guild?.name || "DM"}`)
    console.log(`   ⏰ Criado: ${new Date(interaction.createdTimestamp).toISOString()}`)
    console.log(`   🕐 Idade: ${Date.now() - interaction.createdTimestamp}ms`)
    console.log(`   📝 Respondida: ${interaction.replied}`)
    console.log(`   ⏳ Deferida: ${interaction.deferred}`)

    console.log(`🔍 [OPTIONS_DETAILS]`)
    interaction.options.data.forEach((option, index) => {
      console.log(`   ${index + 1}. ${option.name}: ${option.value} (tipo: ${option.type})`)
      if (option.user) {
        console.log(`      👤 Usuário: ${option.user.tag} (${option.user.id})`)
      }
      if (option.member) {
        console.log(`      👥 Membro: ${option.member.user?.tag}`)
      }
    })
  }
}

module.exports = InteractionValidator
