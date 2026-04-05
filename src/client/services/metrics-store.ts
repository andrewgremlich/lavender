import type { EncryptedEntry } from "@shared/types";
import { idbClear, idbDelete, idbGetAll, idbPut } from "./db";

export interface QueueItem {
	id?: number;
	type: "create" | "update" | "delete";
	tempId: string;
	serverId?: string;
	payload?: { encryptedData: string; iv: string };
	timestamp: number;
	retries: number;
}

export const metricsStore = {
	async getAll(): Promise<EncryptedEntry[]> {
		return idbGetAll<EncryptedEntry>("entries");
	},

	async put(entry: EncryptedEntry): Promise<void> {
		return idbPut("entries", entry);
	},

	async remove(id: string): Promise<void> {
		return idbDelete("entries", id);
	},

	async clearCache(): Promise<void> {
		await Promise.all([idbClear("entries"), idbClear("sync_queue")]);
	},

	async clearEntriesOnly(): Promise<void> {
		await idbClear("entries");
	},

	async enqueue(item: Omit<QueueItem, "id">): Promise<void> {
		return idbPut("sync_queue", item);
	},

	async getQueue(): Promise<QueueItem[]> {
		const items = await idbGetAll<QueueItem>("sync_queue");
		return items.sort((a, b) => a.timestamp - b.timestamp);
	},

	async dequeue(id: number): Promise<void> {
		return idbDelete("sync_queue", id);
	},

	async updateQueueServerId(tempId: string, serverId: string): Promise<void> {
		const queue = await this.getQueue();
		for (const item of queue) {
			if (item.tempId === tempId && item.id != null) {
				await idbPut("sync_queue", { ...item, serverId });
			}
		}
	},
};
