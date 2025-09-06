#!/bin/bash

# Download Lavalink v3.7.13.jar if it doesn't exist
if [ ! -f Lavalink.jar ]; then
  echo "Downloading Lavalink.jar version 3.7.13..."
  wget https://github.com/lavalink-devs/lavalink/releases/download/3.7.13/Lavalink.jar
fi

echo "Starting Lavalink..."
java -jar Lavalink.jar
