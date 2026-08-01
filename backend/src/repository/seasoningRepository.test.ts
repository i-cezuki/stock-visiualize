import { describe, it, expect, beforeEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBClient, ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  GetCommand,
  PutCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { SeasoningRepository } from "./seasoningRepository";
import type { Seasoning } from "../types/seasoning";

const ddbMock = mockClient(DynamoDBDocumentClient);

function createClient(): DynamoDBDocumentClient {
  return DynamoDBDocumentClient.from(new DynamoDBClient({ region: "us-east-1" }));
}

const sampleSeasoning: Seasoning = {
  id: "01JABC123",
  name: "醤油",
  category: "液体",
  icon: "liquid",
  color: "#5B3714",
  amountLevel: 75,
  needsPurchase: false,
  memo: "",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

describe("SeasoningRepository", () => {
  beforeEach(() => {
    ddbMock.reset();
  });

  it("lists seasonings for a user via a PK query", async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [{ PK: "USER#user-1", SK: "SEASONING#01JABC123", ...sampleSeasoning }],
    });

    const repository = new SeasoningRepository(createClient());
    const result = await repository.list("user-1");

    expect(result).toEqual([sampleSeasoning]);
    expect(ddbMock.commandCalls(QueryCommand)[0].args[0].input).toMatchObject({
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
      ExpressionAttributeValues: { ":pk": "USER#user-1", ":skPrefix": "SEASONING#" },
    });
  });

  it("gets a single seasoning by id", async () => {
    ddbMock.on(GetCommand).resolves({
      Item: { PK: "USER#user-1", SK: "SEASONING#01JABC123", ...sampleSeasoning },
    });

    const repository = new SeasoningRepository(createClient());
    const result = await repository.get("user-1", "01JABC123");

    expect(result).toEqual(sampleSeasoning);
  });

  it("returns undefined when the seasoning does not exist", async () => {
    ddbMock.on(GetCommand).resolves({});

    const repository = new SeasoningRepository(createClient());
    const result = await repository.get("user-1", "missing");

    expect(result).toBeUndefined();
  });

  it("creates a seasoning with an attribute_not_exists condition", async () => {
    ddbMock.on(PutCommand).resolves({});

    const repository = new SeasoningRepository(createClient());
    await repository.create("user-1", sampleSeasoning);

    expect(ddbMock.commandCalls(PutCommand)[0].args[0].input).toMatchObject({
      ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
    });
  });

  it("throws a 409 conflict when creating a duplicate id", async () => {
    ddbMock.on(PutCommand).rejects(
      new ConditionalCheckFailedException({ message: "conflict", $metadata: {} })
    );

    const repository = new SeasoningRepository(createClient());

    await expect(repository.create("user-1", sampleSeasoning)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("throws a 404 when updating a seasoning that does not exist", async () => {
    ddbMock.on(PutCommand).rejects(
      new ConditionalCheckFailedException({ message: "missing", $metadata: {} })
    );

    const repository = new SeasoningRepository(createClient());

    await expect(repository.update("user-1", sampleSeasoning)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("throws a 404 when deleting a seasoning that does not exist", async () => {
    ddbMock.on(DeleteCommand).rejects(
      new ConditionalCheckFailedException({ message: "missing", $metadata: {} })
    );

    const repository = new SeasoningRepository(createClient());

    await expect(repository.delete("user-1", "01JABC123")).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
