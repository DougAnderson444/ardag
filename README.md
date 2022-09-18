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

```js
const ardag = initializeArDag({ arweave: Arweave, post?: Function })
```

Where Arweave client is mandatory, and `post` is an optional override function you can pass in to post uploads to Arweave. By default and for testing purposes, use `arweave.transaction.post`, and for Bundlr you'd use `wallet.arweaveAPI.dispatch` (when using [PeerPiper/web3-wallet-connector](https://github.com/PeerPiper/web3-wallet-connector)) or ArConnect's `.dispatch()` feature.

### getInstance

Once you've initialized an ArDag, you can use the client to make or get an instance:

```js
const myArDag = await ardag.getInstance({
	dag: DagRepo;
	wallet?: JWKInterface | 'use_wallet';
	dagOwner?: string | false;
})
```

Where `dag` is a required `type DagRepo` from [@douganderson444/ipld-car-txs](https://github.com/DougAnderson444/ipld-car-txs). A `DagRepo` is an extension of [DagAPI](https://github.com/ipfs/js-ipfs/blob/89aeaf8e25320276391653104981e37a73f29de9/packages/ipfs-core/src/components/dag/index.js#L7) with a `tx` property which enables you to build a Dag one transaction at a time (and save it to Arweave using this library).

Where `wallet` is an Arweave `JWKInterface`, defaults to the string `use_wallet`. If no `JWK` is specified, ArDag will look for a `arweavewallet` on the `window` oject (see [PeerPiper/web3-wallet-connector](https://github.com/PeerPiper/web3-wallet-connector) to make one in 4 lines of code)

### instance.save()

Once you have an instance initialized and made, you can save data to it. Save an object with a label called `tag`:

```js
let rootCID = await myArDag.save(tag, object);
```

Where `tag: string, object: object`. For example, to save a phone number object to a "Phone" tag:

```js
let rootCID = await myArDag.save('Phone', { number: '555-1234' });
```

This saves a `tag` key associated with any object to the root of the Dag. After save, `rootCID/tag/obj` will get `object`. Previously saved tags will be available at `rootCID/tag/prev/obj` and `rootCID/tag/prev/prev/obj` and so on down to the genesis version saved. Most of the time you will just want the latest object value, so use the following convenience function to get it:

### instance.latest(tag)

Once you have ArDag data into your ArDag instance, you can get the latest tag info using the convenience function:

```js
const latestPhone = await myArDag.latest('Phone');
console.log(latestPhone.number); // 555-1234
```

### instance.dag.get(cid, {path: '/tag/obj/path/to/value})

The advanced way to then get the latest data from your writable instance is to use the `dag` property + the `path` to get the value. This is the same as `ipfs.dag`, with the object being under the `obj` key, and previous version being under the `prev/obj` or `prev/prev/obj` or `prev/prev/prev/obj` key.

```js
// dag is DagAPI (ipfs.dag.get) or a DagRepo

let currentNumber = (await myArDag.dag.get(dag.rootCID, { path: `/${tag}/obj/number` })).value;

const prevObj = (await myArDag.dag.get(dag.rootCID, { path: `/${tag}/prev/obj/number` })).value;
```

### load()

If you are only going to read an ArDag from an Arweave contract by loading it into your DAG, use load.

```js
import { createDagRepo } from '@douganderson444/ipld-car-txs';
import * as ArDag from '@douganderson444/ardag';

const ardag = ArDag.initializeArDag({ arweave, post });
const dag = await createDagRepo({ path: 'optional-unique-path-name' }); // DagRepo = ipfs.DagAPI + a tx property from ipld-dag-txs
await ardag.load({ dagOwner, dag, arweave });
const latestPhone = await ardag.latest('phone');

// advanced method via the dag data from my dag object
const phoneNumber = (await dag.get(dag.rootCID, { path: 'contact/obj/phone' })).value;
const oldPhoneNumber = (await dag.get(dag.rootCID, { path: 'contact/prev/obj/phone' })).value;
```

During `load`, `dag.rootCID` will be set to the first root CID loaded, which should be the latest buffer saved to Arweave.

## Demo/Tests

Full experiments located in `./src/lib/tests.ts`

## Run

Run `npm run dev` to start svelte.

`npm run dev`

run `npm run dev:arlocal` to start a local instance of Arweave:

`npm run dev:arlocal`

Then navigate to localhost, paste your arlocal url in the input slot, and see the test pass.

# Design

The data is saved to Arweave [data transactions](https://github.com/ArweaveTeam/arweave-js#create-a-data-transaction) with the Tag "ArDag". Then the transactions are retrieved by searcing this wallet's ArDag.

RootCID is set to the latest rootCID for the most recent transaction.
