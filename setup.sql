create table players
      (
          id      integer           not null
              constraint players_pk
                  primary key autoincrement
              constraint players_pk_2
                  unique,
          name    varchar           not null
              constraint players_pk_3
                  unique,
          token   varchar(24)       not null
              constraint players_pk_4
                  unique,
          created DATETIME default CURRENT_TIMESTAMP not null
          balance float default 0 not null
      )