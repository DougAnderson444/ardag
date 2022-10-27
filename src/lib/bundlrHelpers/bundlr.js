import { signers, createData } from 'arbundles';
import { uploadDataToBundlr } from './uploader.js';

export async function post(tx) {
	// grab tx data and tags
	const data = tx.get('data', { decode: true, string: false });
	// @ts-expect-error
	const tags = tx.get('tags').map((tag) => ({
		name: tag.get('name', { decode: true, string: true }),
		value: tag.get('value', { decode: true, string: true })
	}));

	try {
		// create bundlr tx as a data entry
		const dataSigner = new signers.ArweaveSigner(this.wallet);
		const dataEntry = createData(data, dataSigner, { tags });

		// sign and upload bundler tx
		await dataEntry.sign(dataSigner);
		await uploadDataToBundlr(dataEntry); // TODO: Move outside wallet, not a crypto operation

		return dataEntry.id;
	} catch (e) {
		console.log('Error signing', e);
	}
}
