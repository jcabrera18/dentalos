import Link from 'next/link'
import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { LEGAL } from '@/lib/legal'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Términos y Condiciones · VitalOS',
  description:
    'Términos y condiciones de uso del servicio VitalOS: software de gestión para profesionales y clínicas de salud. Tratamiento de datos personales conforme a la Ley 25.326 de Argentina.',
}

// ── Primitivos de layout del documento ─────────────────────────
function Section({
  id,
  n,
  title,
  children,
}: {
  id: string
  n: number
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-xl font-extrabold text-[#0F1720] mb-4 flex items-baseline gap-3">
        <span className="text-[#00C4BC] tabular-nums">{n}.</span>
        {title}
      </h2>
      <div className="space-y-4 text-[#374151] text-[15px] leading-relaxed">{children}</div>
    </section>
  )
}

export default function TermsPage() {
  const sections: { id: string; title: string }[] = [
    { id: 'objeto', title: 'Objeto y aceptación' },
    { id: 'definiciones', title: 'Definiciones' },
    { id: 'servicio', title: 'Descripción del servicio' },
    { id: 'cuenta', title: 'Registro, cuenta y uso' },
    { id: 'planes', title: 'Prueba gratuita, planes y pagos' },
    { id: 'roles-datos', title: 'Datos personales: roles de las partes' },
    { id: 'obligaciones-cliente', title: 'Obligaciones del Cliente' },
    { id: 'seguridad', title: 'Seguridad y cifrado de la información' },
    { id: 'confidencialidad', title: 'Confidencialidad y secreto profesional' },
    { id: 'alojamiento', title: 'Alojamiento y transferencia internacional' },
    { id: 'incidentes', title: 'Incidentes de seguridad' },
    { id: 'disponibilidad', title: 'Disponibilidad y soporte' },
    { id: 'propiedad', title: 'Propiedad intelectual' },
    { id: 'responsabilidad', title: 'Limitación de responsabilidad' },
    { id: 'baja', title: 'Vigencia, baja y devolución de datos' },
    { id: 'modificaciones', title: 'Modificaciones' },
    { id: 'ley', title: 'Ley aplicable y jurisdicción' },
    { id: 'contacto', title: 'Contacto y ejercicio de derechos' },
  ]

  return (
    <div className={`${jakarta.className} min-h-screen bg-white`}>
      {/* Top bar */}
      <header className="border-b border-[#F3F4F6] bg-white/90 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="text-xl font-extrabold tracking-tight text-[#0F1720]">
            Vital<span className="text-[#00C4BC]">OS</span>
          </Link>
          <Link href="/register" className="text-sm font-semibold text-[#00C4BC] hover:underline">
            Crear cuenta
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        {/* Title */}
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold text-[#0F1720] mb-3">Términos y Condiciones</h1>
          <p className="text-[#6B7280] text-sm">
            Última actualización: {LEGAL.lastUpdated}. Estos términos regulan el uso del servicio VitalOS.
            Leelos con atención: al crear una cuenta manifestás que los aceptás en su totalidad.
          </p>
        </div>

        {/* Índice */}
        <nav className="mb-12 rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-5">
          <p className="text-xs font-bold text-[#0F1720] uppercase tracking-wider mb-3">Contenido</p>
          <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-[#374151]">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="hover:text-[#00C4BC] transition-colors">
                  <span className="text-[#9CA3AF] tabular-nums mr-1.5">{i + 1}.</span>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-10">
          <Section id="objeto" n={1} title="Objeto y aceptación">
            <p>
              Estos Términos y Condiciones (los &quot;Términos&quot;) regulan el acceso y uso de la
              plataforma de software como servicio (SaaS) <strong>VitalOS</strong> (el
              &quot;Servicio&quot;), destinada a la gestión de consultorios, clínicas y profesionales
              de la salud. El Servicio es provisto por <strong>{LEGAL.operator}</strong>
              {LEGAL.taxId && <>, CUIT <strong>{LEGAL.taxId}</strong></>}, con domicilio de contacto
              en <strong>{LEGAL.address}</strong>, República Argentina (&quot;VitalOS&quot;,
              &quot;nosotros&quot;).
            </p>
            <p>
              El usuario que crea una cuenta y la organización de salud en cuyo nombre lo hace (el
              &quot;Cliente&quot;, &quot;vos&quot;) declara ser mayor de edad, contar con capacidad
              legal y, cuando corresponda, estar matriculado y habilitado para ejercer su profesión,
              así como tener facultades suficientes para obligar a la organización que representa.
            </p>
            <p>
              Al registrarte, hacer clic en &quot;Crear cuenta&quot; o utilizar el Servicio aceptás
              estos Términos y la{' '}
              <a href="#roles-datos" className="text-[#00C4BC] hover:underline">
                información sobre tratamiento de datos personales
              </a>{' '}
              que forman parte integrante de ellos. Si no estás de acuerdo, no utilices el Servicio.
            </p>
          </Section>

          <Section id="definiciones" n={2} title="Definiciones">
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Datos personales:</strong> toda información referida a personas humanas
                determinadas o determinables, conforme la Ley N° 25.326 de Protección de los Datos
                Personales (&quot;LPDP&quot;).
              </li>
              <li>
                <strong>Datos sensibles / datos de salud:</strong> datos personales que revelan
                información referente a la salud de una persona. Los datos clínicos de pacientes que
                el Cliente carga en el Servicio son datos sensibles y reciben la máxima protección.
              </li>
              <li>
                <strong>Responsable del tratamiento:</strong> quien decide sobre la finalidad y el
                contenido del tratamiento de datos. En relación con los datos de pacientes, el
                Responsable es el <strong>Cliente</strong>.
              </li>
              <li>
                <strong>Encargado del tratamiento:</strong> quien trata datos por cuenta del
                Responsable. Respecto de los datos de pacientes, el Encargado es{' '}
                <strong>VitalOS</strong> (art. 25 LPDP).
              </li>
              <li>
                <strong>Paciente / Titular del dato:</strong> la persona a la que se refieren los
                datos cargados en el Servicio.
              </li>
            </ul>
          </Section>

          <Section id="servicio" n={3} title="Descripción del servicio">
            <p>
              VitalOS ofrece herramientas de agenda de turnos, gestión de pacientes, historia
              clínica digital, finanzas, facturación electrónica (integración con AFIP/ARCA) y
              comunicaciones con pacientes (por ejemplo, recordatorios). El alcance concreto depende
              del plan contratado y puede variar con el tiempo.
            </p>
            <p>
              El Servicio es una <strong>herramienta de gestión</strong>: no sustituye el juicio
              clínico ni la responsabilidad profesional del Cliente, no presta servicios de salud y
              no constituye asesoramiento médico, contable, impositivo ni legal. El Cliente es el
              único responsable de las decisiones clínicas y administrativas que adopte y de la
              exactitud de la información que registra.
            </p>
          </Section>

          <Section id="cuenta" n={4} title="Registro, cuenta y uso">
            <p>
              Para usar el Servicio debés crear una cuenta con datos veraces y mantenerlos
              actualizados.
            </p>
            <p>
              <strong>Sos el único responsable de tu contraseña y de tus credenciales.</strong> Debés
              mantenerlas en secreto y no compartirlas. Toda actividad realizada bajo tu cuenta y las
              de los profesionales y colaboradores que invites se considera hecha por vos. La pérdida,
              el olvido, la divulgación o el uso indebido de tus credenciales —y cualquier
              consecuencia derivada de ello, incluido el acceso no autorizado a tu cuenta— son de tu
              exclusiva responsabilidad. VitalOS no almacena tu contraseña en texto legible y, por lo
              tanto, no puede recuperártela: ante un olvido, solo podés restablecerla mediante el
              mecanismo de recuperación por email. Notificanos de inmediato ante cualquier uso no
              autorizado que detectes.
            </p>
            <p>Te comprometés a no:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>usar el Servicio con fines ilícitos o contrarios a estos Términos;</li>
              <li>
                cargar datos de personas sin contar con base legal para hacerlo (ver sección 7);
              </li>
              <li>
                intentar vulnerar la seguridad, acceder a datos de otras organizaciones, o realizar
                ingeniería inversa, scraping masivo o pruebas de intrusión sin autorización previa y
                por escrito;
              </li>
              <li>revender o ceder el acceso al Servicio sin nuestro consentimiento.</li>
            </ul>
            <p>
              Cada organización opera en un entorno lógicamente aislado. Podemos suspender cuentas
              ante incumplimientos graves, riesgo de seguridad o falta de pago, procurando avisarte
              cuando sea razonablemente posible.
            </p>
          </Section>

          <Section id="planes" n={5} title="Prueba gratuita, planes y pagos">
            <p>
              El Servicio puede ofrecer un período de prueba gratuito sin necesidad de tarjeta. Al
              finalizar la prueba, la continuidad del Servicio requiere la contratación de un plan
              pago. Los precios, impuestos aplicables y condiciones de cada plan se informan al
              momento de la contratación y pueden actualizarse con aviso previo razonable.
            </p>
            <p>
              Salvo que la normativa aplicable disponga lo contrario, los importes abonados no son
              reembolsables por períodos ya transcurridos. Podés cancelar tu suscripción en cualquier
              momento; la baja surte efecto al final del período ya facturado.
            </p>
          </Section>

          <Section id="roles-datos" n={6} title="Datos personales: roles de las partes">
            <p>
              El tratamiento de datos personales se rige por la Ley N° 25.326, su Decreto
              reglamentario N° 1558/2001 y las normas de la Agencia de Acceso a la Información Pública
              (&quot;AAIP&quot;).
            </p>
            <p>
              Respecto de los <strong>datos de los pacientes</strong> que el Cliente carga y gestiona
              en el Servicio, las partes acuerdan que el <strong>Cliente es el Responsable</strong> del
              tratamiento y <strong>VitalOS actúa como Encargado</strong> (art. 25 LPDP). En tal
              carácter, VitalOS:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                trata esos datos <strong>únicamente</strong> siguiendo las instrucciones del Cliente y
                con la finalidad de prestar el Servicio; no los usa para fines propios ni los cede a
                terceros, salvo obligación legal;
              </li>
              <li>
                aplica las medidas de seguridad descriptas en la sección 8 y guarda confidencialidad
                aun después de finalizada la relación;
              </li>
              <li>
                puede recurrir a subencargados (proveedores de infraestructura, por ejemplo de
                alojamiento, mensajería o facturación) obligados a niveles de protección equivalentes;
              </li>
              <li>
                asiste razonablemente al Cliente para responder las solicitudes de los pacientes y los
                requerimientos de la autoridad de control.
              </li>
            </ul>
            <p>
              Las condiciones de este tratamiento como Encargado se detallan en el{' '}
              <Link href="/dpa" className="text-[#00C4BC] hover:underline">
                Acuerdo de Tratamiento de Datos (DPA)
              </Link>
              , que forma parte integrante de estos Términos.
            </p>
            <p>
              Respecto de los <strong>datos del propio Cliente</strong> (datos de registro,
              facturación y uso del Servicio), VitalOS actúa como Responsable y los trata según se
              describe en la{' '}
              <Link href="/privacy" className="text-[#00C4BC] hover:underline">
                Política de Privacidad
              </Link>
              .
            </p>
          </Section>

          <Section id="obligaciones-cliente" n={7} title="Obligaciones del Cliente">
            <p>Como Responsable del tratamiento de los datos de tus pacientes, te obligás a:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                contar con una <strong>base legal</strong> para tratar esos datos y, cuando
                corresponda, obtener el <strong>consentimiento informado</strong> del paciente para
                el tratamiento de sus datos de salud (art. 7 y 8 LPDP), así como para el envío de
                comunicaciones (por ejemplo, recordatorios por WhatsApp o email);
              </li>
              <li>
                informar a los pacientes, en los términos del art. 6 LPDP, quién trata sus datos y con
                qué finalidad, y atender el ejercicio de sus derechos de acceso, rectificación,
                actualización y supresión;
              </li>
              <li>
                cumplir las normas sobre historia clínica y derechos del paciente (Ley N° 26.529 y
                modificatorias), incluyendo su confección, custodia y{' '}
                <strong>conservación por el plazo legal</strong> (diez años). La historia clínica
                pertenece al paciente y el Cliente es su custodio;
              </li>
              <li>
                cargar datos exactos, pertinentes y no excesivos, y mantenerlos actualizados;
              </li>
              <li>
                gestionar correctamente los permisos de los usuarios que invites a su organización.
              </li>
            </ul>
            <p>
              VitalOS pone a disposición las herramientas técnicas para facilitar el cumplimiento de
              estas obligaciones, pero su cumplimiento corresponde al Cliente.
            </p>
          </Section>

          <Section id="seguridad" n={8} title="Seguridad y cifrado de la información">
            <p>
              Aplicamos medidas técnicas y organizativas orientadas a proteger la información,
              alineadas con las medidas de seguridad recomendadas por la AAIP para datos de salud.
              Entre ellas:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Cifrado de datos clínicos sensibles.</strong> Los campos clínicos más
                sensibles (por ejemplo, alergias, medicación, notas e historia clínica) se almacenan{' '}
                <strong>cifrados a nivel de aplicación con AES-256-GCM</strong>, mediante un esquema
                de &quot;sobre&quot; (envelope encryption): cada organización tiene su propia clave de
                datos, que a su vez se protege con una clave maestra administrada en un servicio de
                gestión de claves (KMS). Las claves no se almacenan junto a los datos, de modo que el
                solo acceso a la base de datos no permite leer esa información.
              </li>
              <li>
                <strong>Aislamiento entre organizaciones.</strong> El acceso a los datos se restringe
                por organización mediante controles de autorización y reglas de seguridad a nivel de
                base de datos.
              </li>
              <li>
                <strong>Transporte cifrado</strong> (HTTPS/TLS), control de accesos, registro de
                auditoría sin exponer datos clínicos, y archivos de pacientes servidos únicamente a
                través de enlaces firmados de acceso temporal.
              </li>
            </ul>
            <p>
              Ningún sistema es infalible. VitalOS no garantiza seguridad absoluta, pero se
              compromete a aplicar medidas razonables y a mejorarlas de forma continua. El Cliente es
              corresponsable de la seguridad en lo que respecta a sus credenciales, dispositivos y la
              gestión de accesos de su personal.
            </p>
          </Section>

          <Section id="confidencialidad" n={9} title="Confidencialidad y secreto profesional">
            <p>
              VitalOS mantiene la confidencialidad de la información del Cliente y de los pacientes.
              Nuestro personal accede a datos clínicos solo cuando es estrictamente necesario para
              operar o dar soporte al Servicio, bajo deberes de confidencialidad. El Cliente, por su
              parte, conserva en todo momento su deber de secreto profesional respecto de la
              información de sus pacientes.
            </p>
          </Section>

          <Section id="alojamiento" n={10} title="Alojamiento y transferencia internacional">
            <p>
              El Servicio se apoya en proveedores de infraestructura en la nube. Parte de la
              infraestructura (por ejemplo, el servicio de gestión de claves de cifrado y
              determinados servicios de procesamiento) puede estar ubicada fuera de la República
              Argentina. Ello puede implicar una <strong>transferencia internacional de datos</strong>{' '}
              en los términos de los arts. 12 LPDP y concordantes.
            </p>
            <p>
              Cuando se realicen transferencias a países que no sean considerados de protección
              adecuada, VitalOS procurará ampararlas en los mecanismos admitidos por la normativa
              argentina (por ejemplo, cláusulas contractuales conforme a los modelos de la AAIP). El
              detalle de los proveedores y las ubicaciones vigentes puede solicitarse por los canales
              de contacto de la sección 18.
            </p>
          </Section>

          <Section id="incidentes" n={11} title="Incidentes de seguridad">
            <p>
              Ante un incidente de seguridad que afecte datos personales tratados en el Servicio,
              VitalOS lo notificará al Cliente sin demora indebida una vez tomado conocimiento,
              describiendo lo ocurrido y las medidas adoptadas, de modo que el Cliente —como
              Responsable— pueda cumplir con sus propias obligaciones de notificación ante la AAIP y,
              cuando corresponda, ante los pacientes afectados, conforme las buenas prácticas y la
              normativa vigente.
            </p>
          </Section>

          <Section id="disponibilidad" n={12} title="Disponibilidad y soporte">
            <p>
              Procuramos mantener el Servicio disponible de forma continua, pero puede haber
              interrupciones por mantenimiento, actualizaciones, fallas de terceros o causas de fuerza
              mayor. El Servicio se presta &quot;tal cual&quot; y &quot;según disponibilidad&quot;,
              sin garantía de operación ininterrumpida o libre de errores. Ofrecemos soporte por los
              canales informados dentro de la plataforma.
            </p>
          </Section>

          <Section id="propiedad" n={13} title="Propiedad intelectual">
            <p>
              El software, la marca &quot;VitalOS&quot;, el diseño y todo el contenido del Servicio
              son de titularidad de VitalOS o de sus licenciantes y están protegidos por la normativa
              de propiedad intelectual. Te otorgamos una licencia limitada, no exclusiva e
              intransferible para usar el Servicio mientras esté vigente la relación.
            </p>
            <p>
              Los datos que cargás (incluidos los de tus pacientes) son y siguen siendo tuyos o de sus
              titulares; VitalOS no adquiere su titularidad y solo los trata para prestar el Servicio.
            </p>
          </Section>

          <Section id="responsabilidad" n={14} title="Limitación de responsabilidad">
            <p>
              En la máxima medida permitida por la ley, VitalOS no será responsable por daños
              indirectos, lucro cesante, pérdida de chance o daños derivados de: (i) decisiones
              clínicas o administrativas del Cliente; (ii) la inexactitud de los datos cargados por el
              Cliente; (iii) el uso indebido de credenciales; (iv) interrupciones o fallas de
              proveedores de terceros; o (v) caso fortuito o fuerza mayor.
            </p>
            <p>
              En cualquier caso, y salvo dolo, la responsabilidad total de VitalOS quedará limitada a
              los importes efectivamente abonados por el Cliente por el Servicio durante los{' '}
              <strong>doce (12) meses</strong> anteriores al hecho que motiva el reclamo. Nada en
              estos Términos limita responsabilidades que la ley no permita limitar.
            </p>
          </Section>

          <Section id="baja" n={15} title="Vigencia, baja y devolución de datos">
            <p>
              Estos Términos rigen mientras uses el Servicio. Podés dar de baja tu cuenta cuando
              quieras. Tras la baja, y durante un plazo razonable, el Cliente podrá solicitar la{' '}
              <strong>exportación</strong> de sus datos. Vencido ese plazo, VitalOS procederá a la
              supresión o anonimización de los datos, salvo aquellos que deba conservar por
              obligación legal (por ejemplo, documentación fiscal) o que el Cliente deba conservar por
              imperio de la Ley N° 26.529 (historia clínica). La responsabilidad de conservar la
              historia clínica por el plazo legal es del Cliente.
            </p>
          </Section>

          <Section id="modificaciones" n={16} title="Modificaciones">
            <p>
              Podemos actualizar estos Términos para reflejar cambios en el Servicio o en la
              normativa. Publicaremos la versión vigente en esta página con su fecha de actualización
              y, ante cambios sustanciales, procuraremos avisarte con antelación razonable. El uso
              continuado del Servicio implica la aceptación de la versión vigente.
            </p>
          </Section>

          <Section id="ley" n={17} title="Ley aplicable y jurisdicción">
            <p>
              Estos Términos se rigen por las leyes de la República Argentina. Para cualquier
              controversia, las partes se someten a los tribunales ordinarios competentes de{' '}
              <strong>{LEGAL.jurisdiction}</strong>, renunciando a cualquier otro fuero. La autoridad de
              control en materia de datos personales es la Agencia de Acceso a la Información Pública
              (AAIP).
            </p>
          </Section>

          <Section id="contacto" n={18} title="Contacto y ejercicio de derechos">
            <p>
              Para consultas sobre estos Términos, el Servicio o el tratamiento de datos, escribinos a{' '}
              <a href={`mailto:${LEGAL.emails.legal}`} className="text-[#00C4BC] hover:underline">
                {LEGAL.emails.legal}
              </a>
              .
            </p>
            <p>
              Los pacientes pueden ejercer sus derechos de acceso, rectificación, actualización y
              supresión ante el Cliente (consultorio o clínica) que trata sus datos. El titular de los
              datos tiene la facultad de ejercer el derecho de acceso en forma gratuita a intervalos
              no inferiores a seis meses, salvo que acredite un interés legítimo (art. 14, inc. 3,
              Ley N° 25.326).
            </p>
            <p className="text-sm text-[#6B7280]">
              La AAIP, órgano de control de la Ley N° 25.326, tiene la atribución de atender las
              denuncias y reclamos que se interpongan con relación al incumplimiento de las normas
              sobre protección de datos personales.
            </p>
          </Section>
        </div>

        {/* Footer nav */}
        <div className="mt-16 pt-8 border-t border-[#F3F4F6] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-[#9CA3AF]">© {new Date().getFullYear()} VitalOS. Todos los derechos reservados.</p>
          <div className="flex items-center gap-5 text-sm">
            <Link href="/" className="text-[#6B7280] hover:text-[#00C4BC] transition-colors">
              Inicio
            </Link>
            <Link href="/register" className="text-[#00C4BC] font-semibold hover:underline">
              Crear cuenta
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
