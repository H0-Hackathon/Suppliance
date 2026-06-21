from database import engine
from sqlalchemy import text

with engine.connect() as conn:
    # Find deleted customers
    result = conn.execute(text("SELECT id FROM customers WHERE email LIKE 'deleted_%';"))
    deleted_ids = [row[0] for row in result]
    
    if deleted_ids:
        print(f"Found deleted customers: {deleted_ids}")
        for cid in deleted_ids:
            conn.execute(text("DELETE FROM pipeline_headlines WHERE customer_id = :cid"), {"cid": cid})
            conn.execute(text("DELETE FROM agent_run_logs WHERE customer_id = :cid"), {"cid": cid})
            conn.execute(text("DELETE FROM supplier_recommendations WHERE customer_id = :cid"), {"cid": cid})
            conn.execute(text("DELETE FROM rss_articles WHERE customer_id = :cid"), {"cid": cid})
            conn.execute(text("DELETE FROM agent_runs WHERE customer_id = :cid"), {"cid": cid})
            conn.execute(text("DELETE FROM tariff_alerts WHERE customer_id = :cid"), {"cid": cid})
            conn.execute(text("DELETE FROM import_orders WHERE customer_id = :cid"), {"cid": cid})
            conn.execute(text("DELETE FROM products WHERE customer_id = :cid"), {"cid": cid})
            conn.execute(text("DELETE FROM suppliers WHERE customer_id = :cid"), {"cid": cid})
            conn.execute(text("DELETE FROM business_profiles WHERE customer_id = :cid"), {"cid": cid})
            conn.execute(text("DELETE FROM customers WHERE id = :cid"), {"cid": cid})
        conn.commit()
        print("Cleanup successful.")
    else:
        print("No deleted customers found.")
