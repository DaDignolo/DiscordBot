require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder } = require('discord.js');
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});
const TOKEN = process.env.DISCORD_TOKEN;

client.once('ready', () => {
  console.log('Bot è online!');
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'join') {
    // Ottieni il canale vocale del membro che ha dato il comando
    const member = interaction.member;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      return interaction.reply('Devi essere in un canale vocale per usare questo comando!');
    }

    try {
      // Fai entrare il bot nel canale vocale
      await voiceChannel.join();
      interaction.reply(`Sono entrato nel canale vocale ${voiceChannel.name}`);
    } catch (error) {
      interaction.reply('Non sono riuscito a entrare nel canale vocale.');
    }
  }
});

// Registrare i comandi slash quando il bot è pronto
client.on('ready', () => {
  const commands = [
    new SlashCommandBuilder().setName('join').setDescription('Fai entrare il bot nel tuo canale vocale'),
  ]
    .map(command => command.toJSON());

  client.application?.commands.set(commands);
});

client.login(TOKEN);