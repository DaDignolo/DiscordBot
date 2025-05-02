require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, PermissionsBitField } = require('discord.js');
const axios = require('axios');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

client.once('ready', () => {
  console.log('✅ Bot è online!');
});

const commands = [
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Banna un utente')
    .addUserOption(option =>
      option.setName('utente')
        .setDescription('Utente da bannare')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Espelli un utente')
    .addUserOption(option =>
      option.setName('utente')
        .setDescription('Utente da espellere')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('freestuff')
    .setDescription('Mostra giochi gratis attuali'),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log('✅ Comandi registrati!');
  } catch (error) {
    console.error('❌ Errore nella registrazione comandi:', error);
  }
})();

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'ban') {
    const user = interaction.options.getUser('utente');
    const member = interaction.guild.members.cache.get(user.id);

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return interaction.reply({ content: '🚫 Non hai il permesso di bannare utenti!', ephemeral: true });
    }

    if (!member || !member.bannable) {
      return interaction.reply('❌ Non posso bannare questo utente.');
    }

    await member.ban();
    interaction.reply(`🔨 Utente **${user.tag}** è stato bannato.`);
  }

  if (commandName === 'kick') {
    const user = interaction.options.getUser('utente');
    const member = interaction.guild.members.cache.get(user.id);

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
      return interaction.reply({ content: '🚫 Non hai il permesso di espellere utenti!', ephemeral: true });
    }

    if (!member || !member.kickable) {
      return interaction.reply('❌ Non posso espellere questo utente.');
    }

    await member.kick();
    interaction.reply(`👢 Utente **${user.tag}** è stato espulso.`);
  }

  if (commandName === 'freestuff') {
    await interaction.deferReply();
    try {
      const res = await axios.get('https://www.reddit.com/r/FreeGameFindings.json');
      const posts = res.data.data.children
        .filter(post => !post.data.over_18)
        .slice(0, 5)
        .map(post => `🎁 [${post.data.title}](${post.data.url})`);

      if (posts.length === 0) {
        interaction.editReply('❌ Nessun gioco gratuito trovato al momento.');
      } else {
        interaction.editReply(`Ecco alcuni giochi gratuiti trovati su Reddit:\n\n${posts.join('\n')}`);
      }
    } catch (error) {
      console.error(error);
      interaction.editReply('❌ Errore nel recupero dei giochi gratuiti.');
    }
  }
});

client.login(TOKEN);