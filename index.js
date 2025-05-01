require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, AudioResource, VoiceConnectionStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ]
});

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

client.once('ready', async () => {
  console.log('✅ Bot è online!');

  const commands = [
    new SlashCommandBuilder().setName('join').setDescription('Fai entrare il bot nel tuo canale vocale'),
    new SlashCommandBuilder().setName('play').setDescription('Riproduce una canzone da un link di YouTube').addStringOption(option => option.setName('url').setDescription('Link del video YouTube').setRequired(true)),
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

    try {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: interaction.guild.id,
        adapterCreator: interaction.guild.voiceAdapterCreator,
      });

      return interaction.reply(`✅ Sono entrato nel canale vocale: ${voiceChannel.name}`);
    } catch (error) {
      console.error('❌ Errore nell\'entrata nel canale vocale:', error);
      return interaction.reply('❌ Non sono riuscito ad entrare nel canale vocale.');
    }
  }

  if (commandName === 'play') {
    const url = interaction.options.getString('url');
    const member = interaction.member;
    const voiceChannel = member.voice?.channel;

    if (!voiceChannel) {
      return interaction.reply('🎧 Devi essere in un canale vocale!');
    }

    if (!ytdl.validateURL(url)) {
      return interaction.reply('❌ Il link fornito non è valido o non è un video YouTube!');
    }

    try {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: interaction.guild.id,
        adapterCreator: interaction.guild.voiceAdapterCreator,
      });

      const stream = ytdl(url, { filter: 'audioonly' });
      const resource = createAudioResource(stream);

      const player = createAudioPlayer();
      player.play(resource);

      connection.subscribe(player);

      player.on(AudioPlayerStatus.Playing, () => {
        interaction.reply(`🎶 Ora sto riproducendo: ${url}`);
      });

      player.on(AudioPlayerStatus.Idle, () => {
        connection.destroy();
      });

    } catch (error) {
      console.error('❌ Errore durante la riproduzione:', error);
      return interaction.reply('❌ Si è verificato un errore durante la riproduzione del brano.');
    }
  }
});

client.login(TOKEN);
