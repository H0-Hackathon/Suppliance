import React, { useRef } from 'react';

import { useNavigate } from 'react-router-dom';

import { motion } from 'framer-motion';

import { MarketingNav } from '../components/marketing/MarketingNav';
import { MarketingJourneyBackdrop } from '../components/marketing/MarketingJourneyBackdrop';

import { CoastGuardHelps } from '../components/marketing/CoastGuardHelps';

import { ScenarioRouteStrip } from '../components/marketing/ScenarioRouteStrip';

import { Reveal, SoftButton, AnimatedRouteMap } from '../components/motion';

import { MOTION } from '../motion/tokens';

import './HomePage.css';



export const HomePage: React.FC = () => {

  const navigate = useNavigate();

  const rootRef = useRef<HTMLDivElement>(null);



  return (

    <div className="mkt-root" ref={rootRef}>
      <MarketingJourneyBackdrop scrollRef={rootRef} />

      <div className="mkt-content">

        <MarketingNav />



        <section className="mkt-hero">

          <div className="mkt-hero-copy">

            <motion.h1

              initial={{ opacity: 0, y: 24 }}

              animate={{ opacity: 1, y: 0 }}

              transition={{ duration: MOTION.hero.duration, ease: MOTION.hero.ease }}

            >

              Someone is watching your shipments. You don&apos;t have to.

            </motion.h1>

            <motion.p

              className="mkt-hero-lead"

              initial={{ opacity: 0, y: 20 }}

              animate={{ opacity: 1, y: 0 }}

              transition={{ duration: MOTION.hero.duration, ease: MOTION.hero.ease, delay: 0.12 }}

            >

              CoastGuard follows your freight across ports and trade lanes — and tells

              you plainly when something shifts, before it becomes a fire drill.

            </motion.p>

            <motion.div

              className="mkt-hero-actions"

              initial={{ opacity: 0, y: 16 }}

              animate={{ opacity: 1, y: 0 }}

              transition={{ duration: MOTION.hero.duration, ease: MOTION.hero.ease, delay: 0.22 }}

            >

              <SoftButton variant="primary" onClick={() => navigate('/dashboard')}>

                Open your workspace

              </SoftButton>

              <SoftButton variant="outline" onClick={() => document.getElementById('scenario')?.scrollIntoView({ behavior: 'smooth' })}>

                Read a real example

              </SoftButton>

            </motion.div>

          </div>



          <AnimatedRouteMap />

        </section>



        <section id="scenario" className="mkt-scenario">

          <div className="mkt-scenario-layout">

            <Reveal className="mkt-scenario-intro" variant="fadeUp">

              <p className="mkt-kicker">Tuesday, March 11 · Oakland, CA</p>

              <h2>Forty containers of oak veneer, stuck where you can&apos;t see them</h2>

            </Reveal>



            <div className="mkt-scenario-body">

              <Reveal className="mkt-scenario-main" variant="fadeUp" delay={0.08}>

                <p>

                  Redwood Home Supply had 40 TEU on <strong>MSCU8472912</strong>, Shanghai to Los

                  Angeles via Singapore — due April 8. Tuesday morning, the vessel was still off

                  PSA Tuas (+4 days) while the carrier portal showed on schedule. CoastGuard

                  flagged it at 6:14 AM; Maria Chen split twelve containers to an earlier

                  connection and moved the launch one week.

                </p>

              </Reveal>



              <Reveal className="mkt-scenario-aside" variant="slideFromRight" delay={0.14}>

                <ScenarioRouteStrip />

                <dl className="mkt-facts">

                  <div>

                    <dt>Container</dt>

                    <dd>MSCU8472912</dd>

                  </div>

                  <div>

                    <dt>Disruption</dt>

                    <dd>Berth delay, PSA Tuas (+4 days)</dd>

                  </div>

                  <div>

                    <dt>Outcome</dt>

                    <dd>Partial reroute; launch moved one week</dd>

                  </div>

                </dl>

              </Reveal>

            </div>

          </div>

        </section>



        <CoastGuardHelps />



        <section className="mkt-close">

          <Reveal className="mkt-close-inner" variant="fadeUp">

            <h2>Stop refreshing carrier portals.</h2>

            <p>Sign in and put your first shipment on watch.</p>

            <SoftButton variant="primary" onClick={() => navigate('/dashboard')}>

              Open your workspace

            </SoftButton>

          </Reveal>

        </section>

      </div>

    </div>

  );

};



export default HomePage;

