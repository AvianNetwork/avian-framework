import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WsEvent } from '@avian-framework/shared';

@WebSocketGateway({ cors: { origin: '*' } })
export class EventsGateway {
  @WebSocketServer()
  server!: Server;

  /** Subscribe to updates for a specific listing. */
  @SubscribeMessage('subscribe:listing')
  handleListingSubscribe(
    @MessageBody() listingId: string,
    @ConnectedSocket() client: Socket
  ) {
    client.join(`listing:${listingId}`);
    return { event: 'subscribed', data: listingId };
  }

  /** Subscribe to personal notifications for a wallet address. */
  @SubscribeMessage('subscribe:address')
  handleAddressSubscribe(
    @MessageBody() address: string,
    @ConnectedSocket() client: Socket
  ) {
    client.join(`address:${address}`);
    return { event: 'subscribed', data: address };
  }

  /** Broadcast listing update to all subscribers. */
  emitListingUpdated(listingId: string, data: unknown) {
    this.server.to(`listing:${listingId}`).emit(WsEvent.LISTING_UPDATED, data);
  }

  /** Broadcast tx confirmation event. */
  emitTxConfirmed(txid: string, data: unknown) {
    this.server.emit(WsEvent.TX_CONFIRMED, { txid, ...data as object });
  }

  /** Broadcast workflow completion. */
  emitWorkflowCompleted(listingId: string, data: unknown) {
    this.server.to(`listing:${listingId}`).emit(WsEvent.WORKFLOW_COMPLETED, data);
  }

  /** Push a notification to a specific wallet address. */
  emitNotification(address: string, notification: {
    id: string;
    type: string;
    title: string;
    body: string;
    link?: string | null;
    createdAt: Date;
  }) {
    this.server.to(`address:${address}`).emit(WsEvent.NOTIFICATION, notification);
  }
}
