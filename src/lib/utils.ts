import * as arGQL from 'ar-gql';
const AR_DAG = 'ArDag';

export async function getOwnerArDag({ arweave, searchTags, dagOwner }) {
	// construct endpoint from arweave api config
	const { host, port, protocol } = arweave.api.config;
	const endpoint = `${protocol}://${host}:${port}/graphql`;

	// set arGQL endpoint
	arGQL.setEndpointUrl(endpoint);

	const query = `query($cursor: String) {
    transactions(
    owners: ["${dagOwner}"]
    tags: [{ name: "App-Name", values: ["ArDag"] }]
    after: $cursor
    first: 100
  ) {
    pageInfo {
      hasNextPage
    }
    edges {
      cursor
      node {
        id
      }
    }
  }
}`;

	try {
		const txs = await arGQL.all(query);

		console.log({ txs });
		// for each txs, return an array of only tx?.data?.transactions.edges[0]?.node?.id
		return txs.map((tx) => tx.node);
	} catch (error) {
		console.log('ArGQL failed', error);
		return [];
	}
}
