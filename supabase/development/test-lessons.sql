-- Development data only. Run as a trusted database operator after migrations.
-- These texts are synthetic and contain no driving instruction or paid material.
begin;
do $$
declare
    fixture record;
    existing public.learning_sections;
begin
    for fixture in select * from (values
        ('a524e32d-2640-4d94-a51c-000000000001'::uuid, 'development-test-free',
         'תוכן בדיקה חינמי. זהו טקסט לדוגמה בלבד, ללא הנחיות נהיגה. פתיחת הטקסט דורשת חשבון מחובר.'::text, null::text),
        ('a524e32d-2640-4d94-a51c-000000000002'::uuid, 'development-test-paid', null::text,
         'תוכן בדיקה בתשלום. זהו טקסט לדוגמה בלבד, ללא חומר מהקורס. פתיחת הטקסט דורשת הרשאת בדיקה זמנית. לא בוצע חיוב.'::text)
    ) as fixtures(id, source_key, free_text, paid_text)
    loop
        perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('publish:' || fixture.id::text, 0));
        select * into existing from public.learning_sections where id = fixture.id;
        if found then
            if existing.source_key <> fixture.source_key or existing.state <> 'published' then
                raise exception 'Test lesson target is occupied or retired';
            end if;
        else
            perform public.publish_section(fixture.id, fixture.source_key, 0, fixture.free_text, fixture.paid_text);
        end if;
    end loop;
end;
$$;
commit;
