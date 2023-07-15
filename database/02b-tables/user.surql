DEFINE TABLE user SCHEMALESS;
    DEFINE FIELD label ON TABLE users TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD description ON TABLE users TYPE string;
    DEFINE FIELD `group` ON TABLE users TYPE string
        VALUE $value OR 'default';
    DEFINE FIELD email ON TABLE users TYPE string
        ASSERT $value != NONE AND is::email($value);

    DEFINE FIELD roles ON TABLE users TYPE array
        ASSERT $value == 'admin' || $value == 'user' || $value == 'guest'
        VALUE $value OR 'guest';

