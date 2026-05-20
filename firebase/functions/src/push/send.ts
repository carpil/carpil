import Expo, { ExpoPushMessage } from 'expo-server-sdk'

interface SendPushNotificationProps {
  pushTokens: string[]
  title: string
  body: string
  data?: Record<string, unknown>
}

const expo = new Expo()

export const sendPushNotifications = async ({
  pushTokens,
  title,
  body,
  data
}: SendPushNotificationProps): Promise<void> => {
  const messages: ExpoPushMessage[] = []
  for (const pushToken of pushTokens) {
    if (Expo.isExpoPushToken(pushToken)) {
      messages.push({
        to: pushToken,
        sound: 'default',
        title,
        body,
        data
      })
    }
  }

  if (messages.length > 0) {
    await expo.sendPushNotificationsAsync(messages)
  }
}
