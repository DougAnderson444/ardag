# ArDag

[Arweave](https://www.arweave.org/) - [Interplanetary Linked Data](https://ipld.io/) - [Directed Acyclic Graph](https://en.wikipedia.org/wiki/Directed_acyclic_graph) Data.

DaGAILed?

Allows you to Save an IPLD DAG in Arweave, one transaction at a time. Minimizes data duplication in Arweave.

## API

_API and docs are a WIP_

## Where

Experiments located in `./src/lib/tests.ts`

## Run

Run `npm run dev` to start svelte.

`npm run dev`

run `npm run dev:arlocal` to start a local instance of Arweave:

`npm run dev:arlocal`

Then navigate to localhost and see the test pass.

# Design

The data is saved to Arweave [data transactions](https://github.com/ArweaveTeam/arweave-js#create-a-data-transaction). Then the transaction id (txid) is saved as an entry in the Smartweave contract.

This way, the entire DAG can be retrieved simply by iterating through the ContractID and resolving the data transactions.
