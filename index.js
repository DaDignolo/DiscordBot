require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, entersState, VoiceConnectionStatus, StreamType } = require('@discordjs/voice');
const ytSearch = require('yt-search');
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

let connection = null;

client.once('ready', async () => {
  console.log('✅ Bot è online!');

  // Registra il comando /play
  const commands = [
    new SlashCommandBuilder()
      .setName('play')
      .setDescription('Riproduce una canzone cercandola su YouTube')
      .addStringOption(option =>
        option.setName('query')
          .setDescription('Nome della canzone o artista')
          .setRequired(true)
      ),
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: '10' }).setToken(TOKEN);

  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log('✅ Comando /play registrato!');
  } catch (error) {
    console.error('❌ Errore nella registrazione comandi:', error);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'play') {
    const query = interaction.options.getString('query');
    const member = interaction.member;
    const voiceChannel = member.voice?.channel;

    if (!voiceChannel) {
      return interaction.reply('🎧 Devi essere in un canale vocale!');
    }

    await interaction.deferReply();

    try {
      // 1. Cerca la canzone su YouTube
      const searchResult = await ytSearch(query);
      if (!searchResult.videos || searchResult.videos.length === 0) {
        return interaction.editReply('❌ Nessun risultato trovato su YouTube per la tua ricerca.');
      }
      const video = searchResult.videos[0];
      const ytUrl = video.url;

      // 2. Connetti al canale vocale
      if (!connection || connection.joinConfig.channelId !== voiceChannel.id) {
        connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: interaction.guild.id,
          adapterCreator: interaction.guild.voiceAdapterCreator,
        });
        await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
      }

      // 3. Riproduci l'audio YouTube
      const stream = ytdl(ytUrl, { filter: 'audioonly', highWaterMark: 1 << 25 });
      const resource = createAudioResource(stream, { inputType: StreamType.Arbitrary });

      const player = createAudioPlayer();
      player.play(resource);

      connection.subscribe(player);

      player.once(AudioPlayerStatus.Playing, () => {
        interaction.editReply(`🎶 Ora sto riproducendo: **${video.title}**\n🔗 [YouTube](${ytUrl})`);
      });

      player.on(AudioPlayerStatus.Idle, () => {
        connection.destroy();
        connection = null;
      });

      player.on('error', error => {
        console.error('❌ Errore player:', error);
        if (!interaction.replied) interaction.editReply('❌ Errore durante la riproduzione del brano.');
        connection.destroy();
        connection = null;
      });

    } catch (error) {
      console.error('❌ Errore durante la riproduzione:', error);
      return interaction.editReply('❌ Si è verificato un errore durante la riproduzione del brano.');
    }
  }
});

client.login(TOKEN);