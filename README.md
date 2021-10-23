# NFT Floor Market

ETH <-> NFT swap service that lets buyers place floor offers for any NFT within a collection. Anyone can take up the offer by selling their NFT for the highest ETH bid.

Version negative one, for experimental use only.

# Installation

`npm install`

# preparation

`cp .env.SAMPLE .env`

And update `.env` with the correct values.

# Commands

Spin local development node: `npm run chain`
Spin fork node (mainnet data): `npm run fork`
Compile: `npm run compile`
Deploy (local): `npm run deploy`
Test (fork mainnet): `npm run test`
