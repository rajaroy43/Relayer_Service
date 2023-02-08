import * as fs from "fs";

const storageFile = "offchain-storage.json";

interface OffchainStorage {
	[key: string]: string;
}

class OffchainStorageService {
	public offchainStorage: OffchainStorage = {};

	constructor() {
		fs.exists(storageFile, (exists) => {
			if (exists) {
				this.offchainStorage = JSON.parse(fs.readFileSync(storageFile).toString());
			}
		});
	}

	private writeStorage(): void {
		fs.writeFileSync(storageFile, JSON.stringify(this.offchainStorage));
	}

	public async get(key: string): Promise<string | undefined> {
		return this.offchainStorage[key];
	}

	public async set(key: string, value: string): Promise<void> {
		this.offchainStorage[key] = value;
		this.writeStorage();
	}
}

export default OffchainStorageService;
