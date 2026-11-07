/// Địa chỉ API.
/// - Android Emulator: http://10.0.2.2:3000/api (mặc định)
/// - Điện thoại thật: chạy với
///   flutter run --dart-define=API_BASE_URL=http://192.168.1.10:3000/api
const String kApiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:3000/api',
);

const String kTokenKey = 'auth_token';
