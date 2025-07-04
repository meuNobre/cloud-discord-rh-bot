// Utilitário para ajudar com problemas de DM
const { EmbedBuilder } = require("discord.js") // Import EmbedBuilder

class DMHelper {
  static async testDMAccess(user) {
    const result = {
      canCreateDM: false,
      canSendMessage: false,
      error: null,
      dmChannel: null,
    }

    try {
      // Tentar criar DM
      const dm = await user.createDM()
      result.canCreateDM = true
      result.dmChannel = dm

      // Tentar enviar uma mensagem de teste (sem realmente enviar)
      // Apenas verificamos se o canal está acessível
      if (dm && dm.id) {
        result.canSendMessage = true
      }
    } catch (error) {
      result.error = error.message
      console.log(`❌ [DM_TEST] Erro para ${user.tag}: ${error.message}`)
    }

    return result
  }

  static async sendDMWithFallback(user, content, fallbackCallback) {
    try {
      const dm = await user.createDM()
      const message = await dm.send(content)
      return { success: true, message, method: "dm" }
    } catch (error) {
      console.log(`❌ [DM_FALLBACK] DM falhou para ${user.tag}: ${error.message}`)

      if (fallbackCallback && typeof fallbackCallback === "function") {
        try {
          const fallbackResult = await fallbackCallback(user, error)
          return { success: true, message: fallbackResult, method: "fallback" }
        } catch (fallbackError) {
          console.error(`❌ [DM_FALLBACK] Fallback também falhou: ${fallbackError.message}`)
          return { success: false, error: fallbackError, method: "fallback_failed" }
        }
      }

      return { success: false, error, method: "dm_failed" }
    }
  }

  static getDMErrorMessage(error) {
    const errorMessages = {
      50007: {
        title: "DMs Bloqueadas",
        description: "O usuário bloqueou mensagens diretas de membros do servidor",
        instructions: [
          "Abrir **Configurações do Discord**",
          "Ir em **Privacidade e Segurança**",
          "Ativar **'Permitir mensagens diretas de membros do servidor'**",
          "Tentar novamente",
        ],
      },
      50013: {
        title: "Sem Permissão",
        description: "O bot não tem permissão para enviar mensagens para este usuário",
        instructions: ["Verificar permissões do bot", "Contatar um administrador"],
      },
      40001: {
        title: "Acesso Negado",
        description: "Acesso negado para enviar mensagem",
        instructions: ["O usuário pode ter bloqueado o bot", "Verificar configurações de privacidade"],
      },
    }

    const code = error.code || error.status
    return (
      errorMessages[code] || {
        title: "Erro Desconhecido",
        description: error.message || "Erro desconhecido ao enviar DM",
        instructions: ["Tentar novamente mais tarde", "Contatar suporte se o problema persistir"],
      }
    )
  }

  static createDMErrorEmbed(user, error, colors) {
    const errorInfo = this.getDMErrorMessage(error)

    return new EmbedBuilder()
      .setTitle(`❌ ${errorInfo.title}`)
      .setDescription(`Não foi possível enviar DM para **${user.tag}**`)
      .addFields(
        {
          name: "🔧 Problema",
          value: errorInfo.description,
          inline: false,
        },
        {
          name: "💡 Instruções para o Usuário",
          value: errorInfo.instructions.map((instruction, index) => `${index + 1}. ${instruction}`).join("\n"),
          inline: false,
        },
        {
          name: "🆔 Código do Erro",
          value: `\`${error.code || error.status || "N/A"}\``,
          inline: true,
        },
        {
          name: "👤 Usuário",
          value: `${user.tag}`,
          inline: true,
        },
      )
      .setColor(colors.ERROR || "#FF4757")
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .setTimestamp()
  }
}

module.exports = DMHelper
