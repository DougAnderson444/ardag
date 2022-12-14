# ArDag

[Arweave](https://www.arweave.org/) - [Interplanetary Linked Data](https://ipld.io/) - [Directed Acyclic Graph](https://en.wikipedia.org/wiki/Directed_acyclic_graph) Data.

Persist IPLD DAG transactions in Arweave, one transaction at a time. Minimizes data duplication in Arweave.

This library is designed as a persistence plugin for `@douganderson444/ipld-car-txs` and should be used in conjuction with that library.

## Basic API

There are 3 main API calls for this library: `persist`, `load`, and `get`. Persist saves a `dag` transaction buffer to Arweave, and `load` loads them from Arweave into a `dagAPI` object. Optionally, `get` just gets the latest value for a tag skipping any `dag` interaction.

### import modules

```js
import { initializeArDag } from '@douganderson444/ardag';
```

### initializeArDag({ arweave: Arweave, post?: Function })

Configure `ardag` by loading an `arweave` and optional custom `post` function into `initialize`.

```js
import { initializeArDag } from '@douganderson444/ardag';
import Arweave from 'arweave';

const config = {}; // optional Arweave config
const post = null; // optional custom arweave post() function override
// const post = wallet.arweaveWalletAPI.dispatch; // or choose Bundlr dispatch instead of arweave.tranaction.post()
const arweave = Arweave.init(config);

const ardag = initializeArDag({ arweave, post });
```

Where Arweave client is mandatory, and `post` is an optional override function you can pass in to post uploads to Arweave. By default and for testing purposes, use `arweave.transaction.post`, and for Bundlr you'd use `wallet.arweaveAPI.dispatch` (when using [PeerPiper/web3-wallet-connector](https://github.com/PeerPiper/web3-wallet-connector)) or ArConnect's `.dispatch()` feature.

### persist(buffer: Uint8Array)

Once you've configured ArDag, save a buffer to Arweave.

```js
const rootCID = await ardag.persist(buffer);
```

Dag transactions will be marked as `ArDag` Tags under this wallet address owner.

### load({ dagOwner: string, dag: DagRepo | DagAPI })

Read an ArDag from Arweave and load it into a given DAG. During `load`, if there is no rootCID, `<DagRepo>.rootCID` will be set to the first root CID loaded, which should be the latest buffer saved to Arweave. If there is already a rootCID nothing will be set and the root must be obtained by other means and manually set.

```js
import { createDagRepo } from '@douganderson444/ipld-car-txs';

const dag = await createDagRepo({ path: 'optional-unique-path-name' }); // DagRepo = ipfs.DagAPI + a tx property from ipld-dag-txs
const address = await arweave.wallets.getAddress(wallet.jwk);
const rootCID = await ardag.load({ dagOwner: address, dag });

// now the dag has loaded the byte data from the owner's arweave ArDag
const tag = 'ContactInfo';
const latestContactInfo = await dag.latest(tag);
```

### async get({ dagOwner: string, tag?: string | null, arweave?: null | Arweave, cid?: null | CID })

If you just need the owner's latest ArDag value but want to skip loading it into a local dag, just `get` the `tag` value.

```js
const dagOwner = 'S0MeArw3AveAddr35ss';
const tag = 'phone';
const latestTag = await ardag.get({ dagOwner, tag });

// or get all tag keys
const latestRootObj = await ardag.get({ dagOwner });
const tags = Object.keys(latestRootObj);
```

You can also use `get` to resolve a CID from an owner's ArDAG without specifying a tag:

```js
// or get all tag keys
const latestRootObj = await ardag.get({ dagOwner });

// ... get a cid from somewhere in their IPLD Dag
const someValue = await ardag.get({ dagOwner, cid });
```

If you specify a `cid` to get, that will take precedence over the `tag` and the `tag` will be ignored.

All the fetching is done from Arweave, if you have the DAG loaded locally, you can simply fetch from the local DAG and skip downloading the data from Arweave.

## Integrated API

The above API calls are intended for `ipld-car-txs` and `ardag` to be used separately for single ArDags. If you're dealing with many different ArDag owners, you will want to keep them separate by creating an instance for each ArDag. ArDag will track each owner's rootCID for you, so you can easily get tag by owner.

If the ArDag owner uses a name service, you can use [NameTag](https://github.com/DougAnderson444/ardag-nametag-loader) to simplify things even further.

For convenience, they've also been integrated together in the below API through an "ArDag Instance".

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

Specifying a `dagOwner` will extend an existing DAG.

?????? If you write to an existing DAG _without_ specifying `dagOwner` it will make a gap in the DAG, effectively starting a new one. The latest Root CID will no longer have a connection to previous roots, and the DAG is considered ended. The data still exists and will be loaded and thus this new Graph can be relinked to the previous CIDs with the `tag` again, but it will require some custom code and is not a part of this library (yet?).

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

### instance.get({cid, tag: string; })

The advanced way to then get the latest data from your writable instance is to use the `dag` property + the `path` to get the value. This is the same as `ipfs.dag`, with the object being under the `obj` key, and previous version being under the `prev/obj` or `prev/prev/obj` or `prev/prev/prev/obj` key.

```js
// dag is DagAPI (ipfs.dag.get) or a DagRepo

let currentNumber = (await myArDag.dag.get(dag.rootCID, { path: `/${tag}/obj/number` })).value;

const prevObj = (await myArDag.dag.get(dag.rootCID, { path: `/${tag}/prev/obj/number` })).value;
```

## Command Line Interface (CLI)

You can also save data to your ArDag through the cli using a `ardag.config.js` file.

First, globally install the package:

```
npm install -g @douganderson444/ardag
```

Then configure an ardag config file

```js
export const config = {
	jwk: {
		path: process.env.JWK_FILE_PATH // Required, arweave jwk file path to use to save to ArDag
	},
	overwrite: false, // Default is false to add onto the previous data
	tag: 'PeerPiper-Web3-Wallet-Connector', // Tag Label for the object
	// The object to be pushed to the dag:
	obj: {
		compiled: {
			path: './src/lib/bundled/es/Web3WalletMenu.svelte.js' // any obj.key with a path will be read from the fs and saved as file bytes
		},
		components: {
			// Optionally also upload the source files uncompiled
		},
		meta: {
			package: packageJson.name,
			version: packageJson.version,
			url: packageJson.homepage,
			title: 'Web3WalletMenu',
			author: 'douganderson444.ar',
			visible: true // whether to list this in the owner's menu of DApps
		},
		thumbnail: {
			path: 'static/thumbnail.png'
		},
		data: {
			// this is my preferences when using the app, it's "My data"
			url: 'https://peerpiper.github.io/iframe-wallet-sdk/'
		}
		// Any other user defined object keys you want
	}
};
```

When the `ardag-deploy` command is run, ArDag will read the config file and save the data to the Dag. Anything that is a `path` is read from the filesystem and converted to a CID, if the CID is unchanged from the latest value, the data is deduplicated so you don't upload data that is already there.

```cli
$ ardag-deploy --local
```

CLI Options

```
Command

ardag-deploy [options]


Options
--overwrite					Only saves the current --obj.* and discards any previous tag value
--local 					Use arlocal
--local=http:localhost:1234	Set the url for local server
```

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
