export const sendReminderNow = async () => ({ status: 200, data: {} });
export const cancelPayment = async (l: string, p: string) => { (window as any).__calls = [...((window as any).__calls || []), ['cancel', l, p]]; return { status: 200, data: {} }; };
export const waiveLateFees = async (l: string) => { (window as any).__calls = [...((window as any).__calls || []), ['waive', l]]; return { status: 200, data: {} }; };
export const enablePush = async () => false; export const pushPermission = () => 'default'; export const pushSupported = async () => false;
export const sendTestReminder = async () => ({ status: 200, data: {} }); export const callApi = async () => ({ status: 200, data: {} }); export const pushNotification = async () => undefined;
export const refreshPushToken = async () => undefined;
