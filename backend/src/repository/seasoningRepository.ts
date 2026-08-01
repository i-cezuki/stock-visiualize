import {
  DynamoDBDocumentClient,
  QueryCommand,
  GetCommand,
  PutCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import type { Seasoning } from "../types/seasoning";
import { conflict, notFound } from "../errors/apiError";

const TABLE_NAME = process.env.TABLE_NAME ?? "Seasonings";

export interface SeasoningRepositoryPort {
  list(userId: string): Promise<Seasoning[]>;
  get(userId: string, id: string): Promise<Seasoning | undefined>;
  create(userId: string, seasoning: Seasoning): Promise<void>;
  update(userId: string, seasoning: Seasoning): Promise<void>;
  delete(userId: string, id: string): Promise<void>;
}

function toItem(userId: string, seasoning: Seasoning): Record<string, unknown> {
  return {
    PK: `USER#${userId}`,
    SK: `SEASONING#${seasoning.id}`,
    ...seasoning,
  };
}

function fromItem(item: Record<string, unknown>): Seasoning {
  const { PK, SK, ...rest } = item;
  return rest as unknown as Seasoning;
}

export class SeasoningRepository implements SeasoningRepositoryPort {
  constructor(private readonly client: DynamoDBDocumentClient) {}

  async list(userId: string): Promise<Seasoning[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": `USER#${userId}`,
          ":skPrefix": "SEASONING#",
        },
      })
    );
    return (result.Items ?? []).map(fromItem);
  }

  async get(userId: string, id: string): Promise<Seasoning | undefined> {
    const result = await this.client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: `USER#${userId}`, SK: `SEASONING#${id}` },
      })
    );
    return result.Item ? fromItem(result.Item) : undefined;
  }

  async create(userId: string, seasoning: Seasoning): Promise<void> {
    try {
      await this.client.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: toItem(userId, seasoning),
          ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
        })
      );
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        throw conflict(`seasoning ${seasoning.id} already exists`);
      }
      throw error;
    }
  }

  async update(userId: string, seasoning: Seasoning): Promise<void> {
    try {
      await this.client.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: toItem(userId, seasoning),
          ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
        })
      );
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        throw notFound(`seasoning ${seasoning.id} not found`);
      }
      throw error;
    }
  }

  async delete(userId: string, id: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: { PK: `USER#${userId}`, SK: `SEASONING#${id}` },
          ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
        })
      );
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        throw notFound(`seasoning ${id} not found`);
      }
      throw error;
    }
  }
}
