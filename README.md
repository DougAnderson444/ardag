# ArDag

[Arweave](https://www.arweave.org/) - [Interplanetary Linked Data](https://ipld.io/) - [Directed Acyclic Graph](https://en.wikipedia.org/wiki/Directed_acyclic_graph) Data.

Save an IPLD DAG in Arweave, one transaction at a time. Minimizes data duplication in Arweave.

## API

### import

```js
import { initializeArDag, load } from '@douganderson444/ardag'
// or
import * as ArDag  from '@douganderson444/ardag'`
```

### initializeArDag

`const ardag = initializeArDag({ arweave: Arweave, post?: Function })`

Where Arweave client is mandatory, and `post` is an optional override function you can pass in to post uploads to Arweave. By default and for testing purposes, use `arweave.transaction.post`, and for Bundlr you'd use `wallet.arweaveAPI.dispatch` (when using [PeerPiper/web3-wallet-connector](https://github.com/PeerPiper/web3-wallet-connector)) or ArConnect's `.dispatch()` feature.

### getInstance

Once you've initialized an ArDag, you can use the client to make or get an instance:

```js
const myArDag = await ardag.getInstance({
	dag: DagRepo;
	wallet?: JWKInterface | 'use_wallet';
	owner?: string | false;
	source?: string;
	contractId?: string;
})
```

Where `dag` is a required `type DagRepo` from [@douganderson444/ipld-car-txs](https://github.com/DougAnderson444/ipld-car-txs). A `DagRepo` is an extension of [DagAPI](https://github.com/ipfs/js-ipfs/blob/89aeaf8e25320276391653104981e37a73f29de9/packages/ipfs-core/src/components/dag/index.js#L7) with a `tx` property which enables you to build a Dag one transaction at a time (and save it to Arweave using this library).

Where `wallet` is an Arweave `JWKInterface`, defaults to the string `use_wallet`. It will look for a `arweavewallet` on the `window` oject (see [PeerPiper/web3-wallet-connector](https://github.com/PeerPiper/web3-wallet-connector) to make one in 4 lines of code)

Where `owner` is an optional Smartweave Contract owner, if you want to set the write ability to someone other than the wallet owner (if you are setting up an ArDag for someone else).

Where `source` is optional custom Arweave Smartweave Contract source to override the default contract (advanced users only).

Where `contractId` is an optional pre-existing Smartweave Contract Id (Tx ID) to load for this instance. Useful for continuing to add to an existing ArDAG. If not set, ArDag will create a new contract for you so you can start a fresh one.

### instance.save()

Once you have an instance initialized and made, you can save data to it. Save an object with a label called `tag`:

```js
let rootCID = await myArDag.save(tag, object);
```

Where `tag: string, object: object`.

```js
let rootCID = await myArDag.save('Phone', { number: '555-1234' });
```

Saves a `tag` key associated with any object to the Root of the Dag. After save, `rootCID/tag/val` will get `object`. Previously saved tags will be available at `rootCID/tag/prev/val` and `rootCID/tag/prev/prev/val` and so on down to the genesis version saved.

### instance.latest(tag)

Once you have saved or loaded ArDag data into your ArDag instance, you can get the latest tag info using the convenience function:

```js
const latestPhone = await myArDag.latest('Phone');
console.log(latestPhone.number); // 555-1234
```

### `await instance.dag.get(cid, {path: '/tag/path/to/value})`

The easiest way to then get the latest data from your writable instance is to use the embedded `dag` property to get the value.

```js
// dag is DagAPI (ipfs.dag.get) or a DagRepo

let currentNumber = (await myArDag.dag.get(dag.rootCID, { path: `/${tag}/val` })).value;

const prevObj = (await myArDag.dag.get(dag.rootCID, { path: `/${tag}/prev/val` })).value;
```

### `load()`

If you are only going to read an ArDag from an Arweave contract by loading it into your DAG, use load.

```js
import { createDagRepo } from '@douganderson444/ipld-car-txs';
import * as ArDag from '@douganderson444/ardag';

const ardag = ArDag.initializeArDag({ arweave, post });
const dag = await createDagRepo(); // DagRepo = ipfs.DagAPI + a tx property from ipld-dag-txs
await ardag.load({ dag, contractId });

// now I can access the dag data from my dag object
const phoneNumber = (await dag.get(rootCID, { path: 'contact/obj/phone' })).value;
const oldPhoneNumber = (await dag.get(rootCID, { path: 'contact/prev/obj/phone' })).value;
```

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
