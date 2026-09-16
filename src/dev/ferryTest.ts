import {
    proposeFerry,
  } from '../providers/ferryProvider'
  
  type TestCase = {
    name: string
    start: {
      lat: number
      lng: number
    }
    destination: {
      lat: number
      lng: number
    }
    allowFerries: boolean
    expectedType:
      | 'road'
      | 'ferry'
    expectedFerryId?: string
  }
  
  const tests: TestCase[] = [
    {
      name:
        'Hirtshals → Bergen, traghetti consentiti',
  
      start: {
        lat: 57.595,
        lng: 9.959,
      },
  
      destination: {
        lat: 60.391,
        lng: 5.322,
      },
  
      allowFerries: true,
  
      expectedType:
        'ferry',
  
      expectedFerryId:
        'hirtshals-bergen',
    },
  
    {
      name:
        'Hirtshals → Bergen, traghetti esclusi',
  
      start: {
        lat: 57.595,
        lng: 9.959,
      },
  
      destination: {
        lat: 60.391,
        lng: 5.322,
      },
  
      allowFerries: false,
  
      expectedType:
        'road',
    },
  
    {
      name:
        'Viganò → Lecco, traghetti consentiti',
  
      start: {
        lat: 45.724,
        lng: 9.326,
      },
  
      destination: {
        lat: 45.856,
        lng: 9.397,
      },
  
      allowFerries: true,
  
      expectedType:
        'road',
    },
  
    {
      name:
        'Hirtshals → Kristiansand, traghetti consentiti',
  
      start: {
        lat: 57.595,
        lng: 9.959,
      },
  
      destination: {
        lat: 58.147,
        lng: 8.005,
      },
  
      allowFerries: true,
  
      expectedType:
        'ferry',
  
      expectedFerryId:
        'hirtshals-kristiansand',
    },
  ]
  
  const root =
    document.querySelector<HTMLDivElement>(
      '#test-root',
    )
  
  if (!root) {
    throw new Error(
      'Contenitore test non trovato.',
    )
  }
  
  let passed = 0
  
  const rows =
    tests.map(
      (test) => {
        const proposal =
          proposeFerry(
            test.start,
            test.destination,
            test.allowFerries,
          )
  
        const actualFerryId =
          proposal.type ===
          'ferry'
            ? proposal
                .candidate
                .connection
                .id
            : undefined
  
        const ok =
          proposal.type ===
            test.expectedType &&
          (
            !test.expectedFerryId ||
            actualFerryId ===
              test.expectedFerryId
          )
  
        if (ok) {
          passed += 1
        }
  
        let detail =
          ''
  
        if (
          proposal.type ===
          'ferry'
        ) {
          const candidate =
            proposal.candidate
  
          detail =
            `${candidate.departurePort.name} → ` +
            `${candidate.arrivalPort.name} · ` +
            `${candidate.connection.operator} · ` +
            `${candidate.connection.durationMinutes} min`
        } else {
          detail =
            proposal.reason
        }
  
        return `
          <div class="test-row ${
            ok
              ? 'ok'
              : 'ko'
          }">
            <div class="test-status">
              ${
                ok
                  ? 'PASS'
                  : 'FAIL'
              }
            </div>
  
            <div>
              <strong>
                ${test.name}
              </strong>
  
              <div class="test-detail">
                Risultato:
                ${proposal.type.toUpperCase()}
              </div>
  
              <div class="test-detail">
                ${detail}
              </div>
            </div>
          </div>
        `
      },
    )
  
  root.innerHTML = `
    <h1>
      MotoRoute · FerryProvider Test
    </h1>
  
    <p class="summary ${
      passed === tests.length
        ? 'ok-summary'
        : 'ko-summary'
    }">
      ${passed}/${tests.length}
      test superati
    </p>
  
    ${rows.join('')}
  `
  