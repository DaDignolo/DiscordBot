#!/bin/bash

# Download Lavalink.jar if it doesn't exist
if [ ! -f Lavalink.jar ]; then
  echo "Downloading Lavalink.jar..."
  wget https://github.com/freyacodes/Lavalink/releases/latest/download/Lavalink.jar
fi

echo "Starting Lavalink..."
java -jar Lavalink.jar