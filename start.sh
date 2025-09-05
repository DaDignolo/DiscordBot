#!/bin/bash

echo "Checking for Lavalink.jar..."

if [ ! -f Lavalink.jar ]; then
  echo "⬇Downloading Lavalink.jar..."
  wget https://github.com/freyacodes/Lavalink/releases/latest/download/Lavalink.jar
fi

echo "Starting Lavalink..."
java -jar Lavalink.jar &

sleep 3

echo "Starting Discord bot..."
node index.js