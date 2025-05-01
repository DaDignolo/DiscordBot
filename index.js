require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, entersState, VoiceConnectionStatus, StreamType } = require('@discordjs/voice');
const fetch = require('node-fetch');
const ytdl = require('ytdl-core');
const ytSearch = require('yt-search');

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

  const commands = [
    new SlashCommandBuilder()
      .setName('spotify')
      .setDescription('Riproduce una canzone da un link Spotify')
      .addStringOption(option =>
        option.setName('url')
          .setDescription('Link della canzone Spotify')
          .setRequired(true)
      ),
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: '10' }).setToken(TOKEN);

  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log('✅ Comando /spotify registrato!');
  } catch (error) {
    console.error('❌ Errore nella registrazione comandi:', error);
  }
});

async function getSpotifyTrackInfo(spotifyUrl) {
  const match = spotifyUrl.match(/track\/([a-zA-Z0-9]+)/);
  if (!match) return null;
  const trackId = match[1];

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;

  const trackResponse = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
    headers: { 'Authorization': 'Bearer ' + accessToken }
  });
  if (!trackResponse.ok) return null;
  const trackData = await trackResponse.json();
  return {
    title: trackData.name,
    artist: trackData.artists.map(a => a.name).join(', ')
  };
}

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'spotify') {
    const url = interaction.options.getString('url');
    const member = interaction.member;
    const voiceChannel = member.voice?.channel;

    if (!voiceChannel) {
      return interaction.reply('🎧 Devi essere in un canale vocale!');
    }

    if (!url.includes('open.spotify.com/track/')) {
      return interaction.reply('❌ Il link fornito non è valido o non è una traccia Spotify!');
    }

    await interaction.deferReply();

    try {
      const trackInfo = await getSpotifyTrackInfo(url);
      if (!trackInfo) {
        return interaction.editReply('❌ Impossibile recuperare le informazioni della traccia Spotify.');
      }

      const ytResult = await ytSearch(`${trackInfo.title} ${trackInfo.artist}`);
      if (!ytResult.videos || ytResult.videos.length === 0) {
        return interaction.editReply('❌ Nessun risultato trovato su YouTube.');
      }
      const ytUrl = ytResult.videos[0].url;

      if (!connection || connection.joinConfig.channelId !== voiceChannel.id) {
        connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: interaction.guild.id,
          adapterCreator: interaction.guild.voiceAdapterCreator,
        });
        await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
      }

      const stream = ytdl(ytUrl, { filter: 'audioonly', highWaterMark: 1 << 25 });
      const resource = createAudioResource(stream, { inputType: StreamType.Arbitrary });

      const player = createAudioPlayer();
      player.play(resource);

      connection.subscribe(player);

      player.once(AudioPlayerStatus.Playing, () => {
        interaction.editReply(`🎶 Ora sto riproducendo: **${trackInfo.title}** di **${trackInfo.artist}**\n🔗 [YouTube](${ytUrl})`);
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