import { makeDomainEvent } from '@lilochat/nest-shared';
import type { ChatMessageSubmittedEvent } from '@lilochat/contracts';

export interface MessageRecord {
  id: string;
  roomId: string;
  userId: string;
  nickname: string;
  content: string;
  createdAt: Date;
}

export interface MessageRepository {
  /** Insert + the persisted outbox event in ONE transaction.
   *  Must be a no-op when `id` already exists (redelivery). */
  createWithEvent(message: MessageRecord, event: unknown): Promise<void>;
}

/**
 * The chat write path (§6.3): the RTG already broadcast optimistically; this
 * makes it durable and emits the ack event. messageId = submitted eventId —
 * the primary key IS the idempotency guarantee, belt to the Redis suspenders.
 */
export class PersistMessageUseCase {
  constructor(private readonly deps: { messages: MessageRepository }) {}

  async execute(event: ChatMessageSubmittedEvent): Promise<void> {
    const { payload } = event;
    const message: MessageRecord = {
      id: event.eventId,
      roomId: payload.roomId,
      userId: payload.userId,
      nickname: payload.nickname,
      content: payload.content,
      createdAt: new Date(payload.sentAt),
    };

    await this.deps.messages.createWithEvent(
      message,
      makeDomainEvent(
        'chat.message.persisted',
        {
          messageId: message.id,
          tempId: payload.tempId,
          roomId: message.roomId,
          userId: message.userId,
          nickname: message.nickname,
          content: message.content,
          createdAt: message.createdAt.toISOString(),
        },
        message.createdAt,
      ),
    );
  }
}
