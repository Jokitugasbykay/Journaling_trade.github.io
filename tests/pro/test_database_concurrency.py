"""Run only against the isolated local test bootstrap, never hosted PostgreSQL."""
import concurrent.futures
import os
import subprocess
import unittest
from uuid import uuid4


@unittest.skipUnless(os.getenv("JT_TEST_PSQL"), "Set JT_TEST_PSQL to the local psql executable")
class QuotaRace(unittest.TestCase):
    def test_one_remaining_unit(self):
        uid = str(uuid4())
        args = [os.environ["JT_TEST_PSQL"], "-h", "127.0.0.1", "-p", os.getenv("JT_TEST_PGPORT", "55432"),
                "-U", "jt_test", "-d", "postgres", "-X", "-v", "ON_ERROR_STOP=1", "-At"]

        def sql(query):
            return subprocess.run(args + ["-c", query], capture_output=True, text=True, timeout=20)

        setup = sql(f"""insert into auth.users(id) values('{uid}');
        set role service_role;
        select public.journal_record_subscription('local-test','{uid}',repeat('a',64),'{uid}','{uid}',
          'pro','active','month',now()-interval '1 day',now()+interval '29 days',now(),'{{}}');
        reset role;
        insert into journal_private.usage_periods(user_id,starts_at,ends_at,used)
        select '{uid}',(a->>'periodStart')::timestamptz,(a->>'periodEnd')::timestamptz,29
        from (select journal_private.user_access('{uid}') a) s;""")
        self.assertEqual(setup.returncode, 0, setup.stderr)
        try:
            def reserve(_):
                return sql(f"""begin; set local role authenticated;
                select set_config('request.jwt.claim.sub','{uid}',true);
                select public.journal_create_job('journal','{{}}',gen_random_uuid(),repeat('b',64));
                select pg_sleep(.2); commit;""".replace("\n", " "))
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
                results = list(pool.map(reserve, range(2)))
            self.assertEqual(sorted(result.returncode == 0 for result in results), [False, True])
            self.assertIn("AI allowance exhausted", next(result.stderr for result in results if result.returncode))
            counts = sql(f"select used||','||reserved from journal_private.usage_periods where user_id='{uid}';")
            self.assertEqual(counts.stdout.strip(), "29,1")
        finally:
            cleanup = sql(f"delete from auth.users where id='{uid}';")
            self.assertEqual(cleanup.returncode, 0, cleanup.stderr)


if __name__ == "__main__":
    unittest.main()
