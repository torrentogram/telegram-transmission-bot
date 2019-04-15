# Telegram Transmission Bot

Telegram bot that controls local Transmission daemon.
You can use it as a personal bot for downloading torrents with Telegram.

## Features

### Add torrent

Just send a .torrent file to this bot and it will download it.

### List torrents

Type: `/list` and the bot will send you a list of the recent 10 torrents.

### Delete torrent and its content

Type a torrent number (from a previous list) and you will see the torrent menu. Currently it contains only a Delete button, which allows you to delete a torrent and the downloaded files.

### View system info

Type: `/info` and you will see Transmission version, download directory and the remaining free space on a volume.

### Success notifications

The bot will notify you when a torrent has been downloaded.

## Installation

Run `npm start` with the following environment variables provided:

```json
{
    "TG_TOKEN": "your-telegram-token",
    "TG_ALLOWED_USERS": "list,of,usernames", //who is allowed to control the bot
    "REDIS": "localhost",
    "TRANSMISSION_HOST": "127.0.0.1",
    "TRANSMISSION_LOGIN": "transmission",
    "TRANSMISSION_PASSWORD": "transmission",
    "DEBUG": "TelegramTransmissionBot", //leave it if you want to enable the logging
    "NODE_ENV": "production"
}
```

You need both Redis and Transmission services running.

### Docker compose

The following Docker-compose config will setup all the services together:

```yml
version: "2.1"

services:
  telegram-transmission-bot:
    restart: always
    image: cornon/telegram-transmission-bot:latest
    environment:
      TG_ALLOWED_USERS: "list,of,users" #put your username(s) here (without an "@")
      TG_TOKEN: "your-telegram-token" #put your token here
      REDIS: redis
      TRANSMISSION_HOST: transmission
      TRANSMISSION_LOGIN: transmission
      TRANSMISSION_PASSWORD: transmission
      DEBUG: TelegramTransmissionBot
    depends_on:
      - redis
      - transmission

  redis:
    restart: always
    image: redis:latest
    volumes:
      - ./volumes/redis:/data

  transmission:
    restart: always
    image: linuxserver/transmission:latest
    volumes:
      - /home/user/Downloads/Movies:/downloads/complete #Change "/home/user/Downloads/Movies" to your path
      - /home/user/tmp:/downloads/incomplete #Change "/home/user/tmp" to your path
      - ./volumes/transmission-config:/config
    ports:
      - "19091:9091" #optional, a port forwarding which allows you to also control your Transmission daemon with an external client
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Europe/Kiev #change it to your timezone
```

Start the services with the command below:

```
docker-compose -f "docker-compose.yml" up -d --build
```