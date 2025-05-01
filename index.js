require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

client.once('ready', async () => {
  console.log('✅ Bot è online!');

  const commands = [
    new SlashCommandBuilder().setName('join').setDescription('Fai entrare il bot nel tuo canale vocale'),
  ].map(command => command.toJSON());

  const rest = new REST({ version: '10' }).setToken(TOKEN);

  try {
    console.log('📡 Registro i comandi slash...');
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log('✅ Comandi registrati!');
  } catch (err) {
    console.error('❌ Errore nella registrazione comandi:', err);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'join') {
    const member = interaction.member;
    const voiceChannel = member.voice?.channel;

    if (!voiceChannel) {
      return interaction.reply('🎧 Devi essere in un canale vocale!');
    }

    return interaction.reply(`(Simulazione) Entrerei nel canale: ${voiceChannel.name}`);
  }
});

client.login(TOKEN);
