// Phase 19.3 - WhatsApp integration API client.
// Company / financial-year headers are attached by the shared apiClient
// interceptor; they are never sent in the request body.

import { apiClient } from './api';
import type {
  SendWhatsAppDocumentInput,
  SendWhatsAppDocumentResult,
  WhatsAppHistoryEntry,
  WhatsAppQrPayload,
  WhatsAppStatus,
} from '../types/whatsapp';

function readErrorMessage(error: unknown, fallback: string): string {
  const axiosError = error as {
    response?: { data?: { error?: { message?: string } } };
    message?: string;
  };
  return axiosError.response?.data?.error?.message ?? axiosError.message ?? fallback;
}

export function whatsAppErrorMessage(error: unknown, fallback: string): string {
  return readErrorMessage(error, fallback);
}

export const getWhatsAppStatus = async (): Promise<WhatsAppStatus> => {
  const response = await apiClient.get<{ status: WhatsAppStatus }>('/integrations/whatsapp/status', {
    timeout: 15000,
  });
  return response.data.status;
};

export const connectWhatsApp = async (): Promise<WhatsAppStatus> => {
  const response = await apiClient.post<{ status: WhatsAppStatus }>(
    '/integrations/whatsapp/connect',
    {},
    { timeout: 30000 }
  );
  return response.data.status;
};

export const getWhatsAppQr = async (): Promise<WhatsAppQrPayload> => {
  const response = await apiClient.get<WhatsAppQrPayload>('/integrations/whatsapp/qr', {
    timeout: 15000,
  });
  return response.data;
};

export const disconnectWhatsApp = async (): Promise<WhatsAppStatus> => {
  const response = await apiClient.post<{ status: WhatsAppStatus }>(
    '/integrations/whatsapp/disconnect',
    {},
    { timeout: 30000 }
  );
  return response.data.status;
};

export const sendWhatsAppDocument = async (
  payload: SendWhatsAppDocumentInput
): Promise<SendWhatsAppDocumentResult> => {
  const response = await apiClient.post<{ result: SendWhatsAppDocumentResult }>(
    '/integrations/whatsapp/send-document',
    payload,
    { timeout: 180000 }
  );
  return response.data.result;
};

export const getWhatsAppHistory = async (params?: {
  limit?: number;
  offset?: number;
  status?: string;
}): Promise<{ items: WhatsAppHistoryEntry[]; total: number }> => {
  const response = await apiClient.get<{ items: WhatsAppHistoryEntry[]; total: number }>(
    '/integrations/whatsapp/history',
    { params }
  );
  return response.data;
};

export const getWhatsAppHistoryEntry = async (id: string): Promise<WhatsAppHistoryEntry> => {
  const response = await apiClient.get<{ entry: WhatsAppHistoryEntry }>(
    `/integrations/whatsapp/history/${id}`
  );
  return response.data.entry;
};