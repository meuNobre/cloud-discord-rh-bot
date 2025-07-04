const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js")

const COLORS = {
  PRIMARY: "#00D9FF",
  SUCCESS: "#00FF88",
  ERROR: "#FF4757",
  WARNING: "#FFA502",
  GOLD: "#FFD700",
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("convidar-externo")
    .setDescription("🎯 Cria convite para candidato externo (não está no servidor)")
    .addStringOption((option) =>
      option.setName("usuario-id").setDescription("🆔 ID do Discord do candidato").setRequired(true),
    )
    .addStringOption((option) =>
      option.setName("nome").setDescription("👤 Nome/tag do candidato (para referência)").setRequired(false),
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true })

      const database = global.ticketSystem.database
      const userId = interaction.options.getString("usuario-id")
      const nomeReferencia = interaction.options.getString("nome") || "Candidato"

      // Validar ID do Discord
      if (!/^\d{17,19}$/.test(userId)) {
        const errorEmbed = new EmbedBuilder()
          .setTitle("❌ ID Inválido")
          .setDescription("O ID fornecido não é um ID válido do Discord.")
          .addFields({
            name: "💡 Como obter o ID",
            value:
              "1. Ativar **Modo Desenvolvedor** nas configurações\n2. Clicar com botão direito no usuário\n3. Selecionar **'Copiar ID'**",
            inline: false,
          })
          .setColor(COLORS.ERROR)
          .setTimestamp()

        return await interaction.editReply({ embeds: [errorEmbed] })
      }

      // Tentar buscar o usuário
      let candidato = null
      try {
        candidato = await interaction.client.users.fetch(userId, { force: true })
        console.log(`✅ [DEBUG] Usuário encontrado: ${candidato.tag}`)
      } catch (fetchError) {
        console.error("❌ Usuário não encontrado:", fetchError)

        const errorEmbed = new EmbedBuilder()
          .setTitle("❌ Usuário Não Encontrado")
          .setDescription("Não foi possível encontrar um usuário com esse ID.")
          .addFields(
            {
              name: "🔍 ID Fornecido",
              value: `\`${userId}\``,
              inline: true,
            },
            {
              name: "🔧 Possíveis Causas",
              value: "• ID incorreto\n• Usuário não existe\n• Conta deletada/suspensa",
              inline: false,
            },
          )
          .setColor(COLORS.ERROR)
          .setTimestamp()

        return await interaction.editReply({ embeds: [errorEmbed] })
      }

      // Verificar se é bot
      if (candidato.bot) {
        const errorEmbed = new EmbedBuilder()
          .setTitle("❌ Usuário Inválido")
          .setDescription("Não é possível enviar convites para bots.")
          .setColor(COLORS.ERROR)
          .setTimestamp()

        return await interaction.editReply({ embeds: [errorEmbed] })
      }

      // Verificar convites pendentes
      try {
        const existingInvite = await database.getPendingInviteByUser(candidato.id)
        if (existingInvite) {
          const errorEmbed = new EmbedBuilder()
            .setTitle("⚠️ Convite Já Existe")
            .setDescription(`${candidato.tag} já possui um convite pendente.`)
            .setColor(COLORS.WARNING)
            .setTimestamp()

          return await interaction.editReply({ embeds: [errorEmbed] })
        }
      } catch (dbError) {
        console.error("❌ Erro ao verificar convites:", dbError)
      }

      // Verificar se usuário está no servidor
      const isInServer = interaction.guild.members.cache.has(candidato.id)

      if (isInServer) {
        // Se está no servidor, usar comando normal
        const infoEmbed = new EmbedBuilder()
          .setTitle("ℹ️ Usuário Já Está no Servidor")
          .setDescription(`${candidato.tag} já está no servidor. Use o comando \`/convidar-processo\` normal.`)
          .setColor(COLORS.WARNING)
          .setTimestamp()

        return await interaction.editReply({ embeds: [infoEmbed] })
      }

      // Criar link de convite especial para o servidor
      let inviteLink = null
      try {
        // Buscar um canal adequado para criar o convite
        const channel = interaction.guild.channels.cache.find(
          (c) =>
            c.type === 0 && // TEXT CHANNEL
            c.permissionsFor(interaction.guild.members.me).has(["CreateInstantInvite"]),
        )

        if (channel) {
          const invite = await channel.createInvite({
            maxAge: 24 * 60 * 60, // 24 horas
            maxUses: 1, // Apenas 1 uso
            unique: true,
            reason: `Convite de recrutamento para ${candidato.tag} por ${interaction.user.tag}`,
          })
          inviteLink = invite.url
          console.log(`✅ [DEBUG] Link de convite criado: ${inviteLink}`)
        }
      } catch (inviteError) {
        console.error("❌ Erro ao criar convite:", inviteError)
      }

      // Tentar enviar DM (provavelmente falhará, mas vamos tentar)
      let dmSuccess = false
      let dmMessage = null

      try {
        const dm = await candidato.createDM()

        const inviteEmbed = new EmbedBuilder()
          .setTitle("🎉 Você foi Selecionado para o Processo Seletivo!")
          .setDescription(
            `Olá, **${candidato.username}**! Você foi aprovado na primeira etapa do nosso processo seletivo.`,
          )
          .setColor(COLORS.PRIMARY)
          .addFields(
            {
              name: "🏆 Parabéns!",
              value: "Sua aplicação foi analisada e aprovada pela nossa equipe de recrutamento.",
              inline: false,
            },
            {
              name: "🔗 Link de Acesso",
              value: inviteLink
                ? `[**Clique aqui para entrar no servidor**](${inviteLink})`
                : "Link será fornecido em breve",
              inline: false,
            },
            {
              name: "⏰ Prazo",
              value: "Você tem **24 horas** para aceitar este convite",
              inline: true,
            },
            {
              name: "🎯 Próximos Passos",
              value:
                "1. Entre no servidor usando o link\n2. Aguarde instruções da equipe\n3. Participe do processo seletivo",
              inline: false,
            },
          )
          .setFooter({
            text: "Hylex • Equipe de Recrutamento",
            iconURL: "https://hylex.gg/cdn/shop/files/hylex-tiny.png?v=1683307225&width=500",
          })
          .setTimestamp()
          .setThumbnail(candidato.displayAvatarURL({ dynamic: true }))

        const actionRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel("🚀 Entrar no Servidor")
            .setStyle(ButtonStyle.Link)
            .setURL(inviteLink || "https://discord.gg/hylex"),
          new ButtonBuilder()
            .setCustomId("aceitar_convite_externo")
            .setLabel("✅ Aceitar Convite")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId("recusar_convite_externo")
            .setLabel("❌ Recusar")
            .setStyle(ButtonStyle.Danger),
        )

        dmMessage = await dm.send({
          embeds: [inviteEmbed],
          components: [actionRow],
        })

        dmSuccess = true
        console.log(`✅ [DEBUG] DM enviada com sucesso para usuário externo`)
      } catch (dmError) {
        console.error("❌ DM falhou (esperado para usuário externo):", dmError.message)
      }

      // Salvar no banco de dados
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
      try {
        await database.createInvite(
          candidato.id,
          candidato.tag,
          dmMessage?.id || "external_invite",
          interaction.user.id,
          expiresAt.toISOString(),
        )

        // Salvar link do convite se foi criado
        if (inviteLink) {
          await database.updateInviteStatus(candidato.id, dmMessage?.id || "external_invite", "pending", inviteLink)
        }
      } catch (dbError) {
        console.error("❌ Erro ao salvar no banco:", dbError)
      }

      // Resposta final
      const resultEmbed = new EmbedBuilder()
        .setTitle(dmSuccess ? "✅ Convite Enviado!" : "⚠️ Convite Registrado")
        .setDescription(
          dmSuccess
            ? `Convite enviado com sucesso para **${candidato.tag}**`
            : `Convite registrado para **${candidato.tag}** (DM não disponível - usuário externo)`,
        )
        .addFields(
          {
            name: "👤 Candidato",
            value: `${candidato.tag} (${candidato.id})`,
            inline: true,
          },
          {
            name: "📍 Status",
            value: isInServer ? "No servidor" : "Usuário externo",
            inline: true,
          },
          {
            name: "📤 DM",
            value: dmSuccess ? "✅ Enviada" : "❌ Falhou (esperado)",
            inline: true,
          },
          {
            name: "🔗 Link de Convite",
            value: inviteLink ? `[Clique aqui](${inviteLink})` : "Não disponível",
            inline: false,
          },
          {
            name: "💡 Próximos Passos",
            value: dmSuccess
              ? "Aguardar resposta do candidato"
              : "• Envie o link manualmente para o candidato\n• Use outros meios de comunicação\n• Aguarde o candidato entrar no servidor",
            inline: false,
          },
        )
        .setColor(dmSuccess ? COLORS.SUCCESS : COLORS.WARNING)
        .setThumbnail(candidato.displayAvatarURL({ dynamic: true }))
        .setTimestamp()

      await interaction.editReply({ embeds: [resultEmbed] })
    } catch (error) {
      console.error("❌ Erro geral:", error)

      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Erro Interno")
        .setDescription("Ocorreu um erro ao processar o convite externo.")
        .setColor(COLORS.ERROR)
        .setTimestamp()

      await interaction.editReply({ embeds: [errorEmbed] })
    }
  },
}
