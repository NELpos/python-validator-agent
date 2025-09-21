# Panther 탐지 규칙 가이드라인

## 기본 규칙 구조

### 필수 함수: rule()

모든 Panther 탐지 규칙은 `rule(event)` 함수를 포함해야 합니다. 이 함수는 의심스러운 활동이 탐지되면 `True`를 반환해야 합니다.

```python
def rule(event):
    # 탐지 로직 구현
    if suspicious_condition(event):
        return True
    return False
```

### 선택적 알림 함수들

#### severity() 함수
탐지의 심각도를 정의합니다.

```python
def severity(event):
    if event.get('critical_field'):
        return 'CRITICAL'
    elif event.get('high_field'):
        return 'HIGH'
    else:
        return 'MEDIUM'
```

#### title() 함수
알림의 제목을 동적으로 생성합니다.

```python
def title(event):
    user = event.get('user', 'unknown')
    action = event.get('action', 'unknown')
    return f"Suspicious {action} by {user}"
```

#### dedup() 함수
중복 알림을 방지하기 위한 식별자를 제공합니다.

```python
def dedup(event):
    return event.get('user') + ':' + event.get('source_ip', '')
```

#### runbook() 함수
대응 절차에 대한 링크나 설명을 제공합니다.

```python
def runbook(event):
    return "https://company.com/runbooks/suspicious-login"
```

## 이벤트 객체 접근 방법

### 기본 접근: get()
안전한 필드 접근을 위해 `get()` 메서드를 사용하세요.

```python
def rule(event):
    user = event.get('user')  # 필드가 없으면 None 반환
    source_ip = event.get('source_ip', 'unknown')  # 기본값 지정
    return user is None or source_ip == 'unknown'
```

### 중첩 필드 접근: deep_get()
중첩된 객체의 필드에 안전하게 접근할 때 사용합니다.

```python
def rule(event):
    country = event.deep_get('location', 'country')
    city = event.deep_get('location', 'city', default='unknown')
    return country in ['CN', 'RU'] and city == 'unknown'
```

### 복잡한 구조 순회: deep_walk()
중첩되고 복잡한 이벤트 구조를 안전하게 처리합니다.

```python
def rule(event):
    suspicious_ips = ['1.2.3.4', '5.6.7.8']

    for ip in event.deep_walk('network_connections', 'destination_ip'):
        if ip in suspicious_ips:
            return True
    return False
```

## 성능 최적화 가이드라인

### 1. 15초 실행 시간 제한
모든 탐지 규칙은 15초 내에 실행을 완료해야 합니다.

```python
# 좋은 예: 빠른 조건 확인
def rule(event):
    # 가장 가능성이 높은 조건을 먼저 확인
    if not event.get('user'):
        return False

    # 복잡한 로직은 나중에
    return check_complex_condition(event)

# 나쁜 예: 비효율적인 반복문
def rule(event):
    # 모든 로그를 순회하는 비효율적인 코드
    for log in event.get('all_logs', []):
        if analyze_complex_pattern(log):  # 시간 소모적
            return True
    return False
```

### 2. 외부 API 호출 금지
탐지 규칙 내에서 외부 API를 호출하지 마세요.

```python
# 나쁜 예: 외부 API 호출
def rule(event):
    import requests
    # 이런 코드는 금지됨
    response = requests.get('https://api.example.com/check')
    return response.json().get('is_suspicious')

# 좋은 예: 내장 데이터 사용
def rule(event):
    suspicious_domains = ['malicious.com', 'evil.org']
    domain = event.get('domain')
    return domain in suspicious_domains
```

## 통합 데이터 모델 (UDM) 사용

가능한 경우 Panther의 통합 데이터 모델 필드를 사용하세요.

```python
def rule(event):
    # UDM 표준 필드 사용
    source_ip = event.udm('source_ip')
    destination_ip = event.udm('destination_ip')
    event_time = event.udm('event_time')

    # 표준화된 필드로 일관된 탐지 로직 구현
    return is_suspicious_connection(source_ip, destination_ip)
```

## 오류 처리 모범 사례

### 안전한 타입 확인

```python
def rule(event):
    try:
        login_attempts = int(event.get('login_attempts', 0))
        return login_attempts > 5
    except (ValueError, TypeError):
        # 타입 변환 실패 시 False 반환
        return False
```

### 필수 필드 검증

```python
def rule(event):
    # 필수 필드가 없으면 탐지하지 않음
    required_fields = ['user', 'action', 'timestamp']
    if not all(event.get(field) for field in required_fields):
        return False

    # 실제 탐지 로직
    return event.get('action') == 'delete' and is_sensitive_resource(event.get('resource'))
```

## 단위 테스트 포함

모든 탐지 규칙에는 포괄적인 단위 테스트를 포함해야 합니다.

```python
def rule(event):
    failed_logins = event.get('failed_login_count', 0)
    return failed_logins >= 5

def title(event):
    user = event.get('user', 'unknown')
    return f"Multiple failed logins for user {user}"

# 단위 테스트
class TestBruteForceLogin(unittest.TestCase):

    def test_triggers_on_multiple_failures(self):
        event = {'failed_login_count': 5, 'user': 'testuser'}
        self.assertTrue(rule(event))

    def test_does_not_trigger_on_few_failures(self):
        event = {'failed_login_count': 3, 'user': 'testuser'}
        self.assertFalse(rule(event))

    def test_title_generation(self):
        event = {'user': 'testuser'}
        expected = "Multiple failed logins for user testuser"
        self.assertEqual(title(event), expected)
```

## 보안 모범 사례

### 1. 입력 검증

```python
def rule(event):
    # 입력값 검증
    user_input = event.get('user_input', '')
    if not isinstance(user_input, str) or len(user_input) > 1000:
        return False

    # SQL 인젝션 패턴 탐지
    sql_patterns = ['union select', 'drop table', '-- ']
    return any(pattern in user_input.lower() for pattern in sql_patterns)
```

### 2. 민감한 정보 로깅 방지

```python
def rule(event):
    # 민감한 정보는 로그에 남기지 않음
    password = event.get('password')  # 값 자체는 사용하지 않음

    # 패스워드 강도만 확인
    if password and len(password) < 8:
        return True
    return False

def title(event):
    # 민감한 정보는 제목에 포함하지 않음
    user = event.get('user', 'unknown')
    return f"Weak password detected for user {user}"
```

## 실제 탐지 규칙 예제

### 예제 1: 의심스러운 로그인 탐지

```python
def rule(event):
    """
    비정상적인 시간대나 지역에서의 로그인을 탐지합니다.
    """
    # 필수 필드 확인
    if not all(event.get(field) for field in ['user', 'timestamp', 'source_ip']):
        return False

    # 업무 시간 외 로그인 확인 (18시-06시)
    hour = event.deep_get('timestamp', 'hour', default=12)
    if hour < 6 or hour > 18:
        return True

    # 의심스러운 국가에서의 로그인
    country = event.deep_get('location', 'country')
    suspicious_countries = ['CN', 'RU', 'KP']

    return country in suspicious_countries

def severity(event):
    country = event.deep_get('location', 'country')
    hour = event.deep_get('timestamp', 'hour', default=12)

    if country in ['KP'] or (hour >= 0 and hour < 6):
        return 'HIGH'
    return 'MEDIUM'

def title(event):
    user = event.get('user', 'unknown')
    country = event.deep_get('location', 'country', default='unknown')
    return f"Suspicious login: {user} from {country}"
```

### 예제 2: 권한 상승 탐지

```python
def rule(event):
    """
    권한 상승 활동을 탐지합니다.
    """
    action = event.get('action', '').lower()
    privilege_actions = ['sudo', 'su', 'runas', 'elevation']

    if not any(priv in action for priv in privilege_actions):
        return False

    # 일반 사용자의 권한 상승
    user_role = event.get('user_role', '').lower()
    if user_role in ['user', 'guest', 'contractor']:
        return True

    # 비정상적인 시간대의 권한 상승
    hour = event.deep_get('timestamp', 'hour', default=12)
    if hour < 6 or hour > 22:
        return True

    return False

def dedup(event):
    user = event.get('user', 'unknown')
    action = event.get('action', 'unknown')
    return f"{user}:{action}"
```