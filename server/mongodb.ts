import { MongoClient, Db, Collection, Document } from 'mongodb';

class MongoDBService {
  private client: MongoClient | null = null;
  private db: Db | null = null;

  async connect(): Promise<void> {
    if (this.client && this.db) {
      return;
    }

    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    try {
      this.client = new MongoClient(uri);
      await this.client.connect();
      
      const dbName = this.extractDatabaseName(uri);
      this.db = this.client.db(dbName);
      
      console.log(`✅ Connected to MongoDB database: ${dbName}`);
    } catch (error) {
      console.error('❌ MongoDB connection error:', error);
      throw error;
    }
  }

  private extractDatabaseName(uri: string): string {
    try {
      const url = new URL(uri);
      const pathname = url.pathname.substring(1);
      if (pathname && pathname !== '') {
        return pathname.split('?')[0];
      }
      return 'restaurant_pos';
    } catch (error) {
      return 'restaurant_pos';
    }
  }

  getDatabase(): Db {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
  }

  getCollection<T extends Document = Document>(name: string): Collection<T> {
    return this.getDatabase().collection<T>(name);
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      console.log('Disconnected from MongoDB');
    }
  }
}

export const mongodb = new MongoDBService();
