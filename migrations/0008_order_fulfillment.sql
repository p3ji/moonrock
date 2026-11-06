-- Track sent item lines and completed orders without changing saved order contents.
ALTER TABLE orders ADD COLUMN fulfilled_items TEXT NOT NULL DEFAULT '[]';
ALTER TABLE orders ADD COLUMN completed INTEGER NOT NULL DEFAULT 0;
